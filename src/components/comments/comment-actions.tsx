'use client';

import { useId, useState, useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { deleteComment } from '@/lib/comments/actions';
import { PASSWORD_MAX } from '@/lib/comments/rules';
import CommentForm from './comment-form';

type Props = {
  commentId: string;
  postId: string;
  locale: Locale;
  dict: Dictionary['comments'];
  nickname: string; // 답글 폼의 "○○ 님에게 답글"
  canReply: boolean; // 최상위 댓글만 답글 가능 (1단계)
  canDelete: boolean; // 작성자(관리자) 답글은 비밀번호가 없으므로 버튼 숨김
};

const ReplyIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

// 댓글 본문은 서버에서 렌더링하고, 버튼과 펼쳐지는 폼만 클라이언트에서 처리
export default function CommentActions({ commentId, postId, locale, dict, nickname, canReply, canDelete }: Props) {
  const id = useId();
  const [mode, setMode] = useState<'reply' | 'delete' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(next: 'reply' | 'delete') {
    setMode((m) => (m === next ? null : next));
    setError(null);
    setPassword('');
  }

  function submitDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await deleteComment({ commentId, password });
      if (!res.ok) setError(dict.errors[res.code]);
      // 성공하면 서버가 페이지를 다시 렌더링해서 이 댓글이 사라지거나 "삭제됨"으로 바뀜
    });
  }

  if (!canReply && !canDelete) return null;

  return (
    <div>
      <div className="mt-0.5 flex gap-3">
        {canReply && (
          <button type="button" onClick={() => toggle('reply')} className="act" aria-expanded={mode === 'reply'}>
            <ReplyIcon />
            {mode === 'reply' ? dict.replyClose : dict.reply}
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={() => toggle('delete')} className="act act-danger" aria-expanded={mode === 'delete'}>
            {dict.delete}
          </button>
        )}
      </div>

      {mode === 'delete' && (
        <form onSubmit={submitDelete} className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5">
          <label htmlFor={`${id}-pw`} className="text-[13.5px] font-semibold text-danger">
            {dict.deletePrompt}
          </label>
          <input
            id={`${id}-pw`}
            type="password"
            className="field h-[38px] min-w-0 flex-[1_1_160px]"
            placeholder={dict.deletePassword}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={PASSWORD_MAX}
            autoComplete="off"
            autoFocus
            required
          />
          <button type="button" onClick={() => setMode(null)} className="btn btn-ghost h-[38px]">
            {dict.cancel}
          </button>
          <button type="submit" disabled={isPending} className="btn btn-danger h-[38px]">
            {dict.deleteSubmit}
          </button>
          {error && (
            <p role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}

      {mode === 'reply' && (
        <div className="mt-4 border-l border-line pl-4 sm:pl-6">
          <CommentForm
            postId={postId}
            parentId={commentId}
            replyToName={nickname}
            locale={locale}
            dict={dict}
            onCancel={() => setMode(null)}
            onPosted={() => setMode(null)}
          />
        </div>
      )}
    </div>
  );
}
