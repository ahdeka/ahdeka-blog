'use client';

import { useCallback, useState, useSyncExternalStore, useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { deleteComment } from '@/lib/comments/actions';
import { DELETE_TOKENS_EVENT, getDeleteToken, removeDeleteToken } from '@/lib/comments/delete-tokens';
import CommentForm from './comment-form';

type Props = {
  commentId: string;
  postId: string;
  locale: Locale;
  dict: Dictionary['comments'];
  nickname: string; // 답글 폼의 "○○ 님에게 답글" (익명이면 "익명")
  canReply: boolean; // 스레드가 삭제(묘비)되지 않았으면 모든 댓글·답글에서 가능
};

const ReplyIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

// 이 브라우저에 이 댓글의 (만료 전) 삭제 토큰이 있는지 구독
// 서버 렌더링 시에는 항상 null → 버튼 없음. 브라우저에서 토큰이 있으면 그때 나타남
function useDeleteToken(commentId: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      window.addEventListener(DELETE_TOKENS_EVENT, onChange);
      window.addEventListener('storage', onChange); // 다른 탭에서 바뀐 경우
      // 만료 시각에 다시 읽어서 버튼을 숨김
      const entry = getDeleteToken(commentId);
      const timer = entry ? window.setTimeout(onChange, entry.expiresAt - Date.now() + 50) : undefined;
      return () => {
        window.removeEventListener(DELETE_TOKENS_EVENT, onChange);
        window.removeEventListener('storage', onChange);
        window.clearTimeout(timer);
      };
    },
    [commentId],
  );
  return useSyncExternalStore(
    subscribe,
    () => getDeleteToken(commentId)?.token ?? null,
    () => null,
  );
}

// 댓글 본문은 서버에서 렌더링하고, 버튼과 펼쳐지는 폼만 클라이언트에서 처리
export default function CommentActions({ commentId, postId, locale, dict, nickname, canReply }: Props) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deleteToken = useDeleteToken(commentId);

  function remove() {
    if (!deleteToken || !window.confirm(dict.deleteConfirm)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteComment({ commentId, deleteToken });
      if (res.ok) {
        removeDeleteToken(commentId);
        // 성공하면 서버가 페이지를 다시 렌더링해서 이 댓글이 사라지거나 "삭제됨"으로 바뀜
        return;
      }
      // 시간이 지났거나 쓸 수 없는 토큰이면 버튼도 정리
      if (res.code === 'expired' || res.code === 'forbidden' || res.code === 'not_found') removeDeleteToken(commentId);
      setError(dict.errors[res.code]);
    });
  }

  if (!canReply && !deleteToken && !error) return null;

  return (
    <div>
      <div className="mt-0.5 flex gap-3">
        {canReply && (
          <button type="button" onClick={() => setReplyOpen((o) => !o)} className="act" aria-expanded={replyOpen}>
            <ReplyIcon />
            {replyOpen ? dict.replyClose : dict.reply}
          </button>
        )}
        {deleteToken && (
          <button type="button" onClick={remove} disabled={isPending} className="act act-danger hover:text-danger">
            {dict.delete}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {replyOpen && (
        <div className="mt-4 border-l border-line pl-4 sm:pl-6">
          <CommentForm
            postId={postId}
            parentId={commentId}
            replyToName={nickname}
            locale={locale}
            dict={dict}
            onCancel={() => setReplyOpen(false)}
            onPosted={() => setReplyOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
