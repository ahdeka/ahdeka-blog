'use client';

import { useId, useState, useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { deleteComment } from '@/lib/comments/actions';
import { PASSWORD_MAX } from '@/lib/comments/rules';
import CommentForm, { inputClass } from './comment-form';

type Props = {
  commentId: string;
  postId: string;
  locale: Locale;
  dict: Dictionary['comments'];
  canReply: boolean; // 최상위 댓글만 답글 가능 (1단계)
  canDelete: boolean; // 작성자(관리자) 답글은 비밀번호가 없으므로 버튼 숨김
};

// 댓글 본문은 서버에서 렌더링하고, 버튼과 펼쳐지는 폼만 클라이언트에서 처리
export default function CommentActions({ commentId, postId, locale, dict, canReply, canDelete }: Props) {
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

  const linkClass = (active: boolean) =>
    `text-xs transition hover:text-neutral-900 dark:hover:text-neutral-100 ${active ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-500'}`;

  return (
    <div className="mt-2">
      <div className="flex gap-4">
        {canReply && (
          <button type="button" onClick={() => toggle('reply')} className={linkClass(mode === 'reply')} aria-expanded={mode === 'reply'}>
            {dict.reply}
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={() => toggle('delete')} className={linkClass(mode === 'delete')} aria-expanded={mode === 'delete'}>
            {dict.delete}
          </button>
        )}
      </div>

      {mode === 'delete' && (
        <form onSubmit={submitDelete} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-pw`} className="sr-only">{dict.deletePassword}</label>
          <input
            id={`${id}-pw`}
            type="password"
            className={`${inputClass} w-auto min-w-0 flex-1 sm:max-w-60`}
            placeholder={dict.deletePassword}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={PASSWORD_MAX}
            autoComplete="off"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {dict.deleteSubmit}
          </button>
          <button type="button" onClick={() => setMode(null)} className="px-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            {dict.cancel}
          </button>
          {error && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {mode === 'reply' && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <CommentForm
            postId={postId}
            parentId={commentId}
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
