'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BODY_MAX } from '@/lib/comments/rules';
import { adminDeleteComment, adminReplyComment } from './actions';

type Props = { id: string; canReply: boolean; hasReplies: boolean };

export default function CommentRowActions({ id, canReply, hasReplies }: Props) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    const msg = hasReplies ? '이 댓글과 달린 답글을 모두 삭제할까요?' : '이 댓글을 삭제할까요?';
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await adminDeleteComment(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function reply(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminReplyComment(id, body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody('');
      setReplying(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <div className="flex gap-4 text-xs">
        {canReply && (
          <button onClick={() => setReplying((v) => !v)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            {replying ? '답글 취소' : '답글'}
          </button>
        )}
        <button onClick={remove} disabled={isPending} className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400">
          삭제
        </button>
      </div>
      {replying && (
        <form onSubmit={reply} className="mt-3 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={BODY_MAX}
            rows={3}
            autoFocus
            required
            placeholder="작성자 답글 (작성자 배지가 붙습니다)"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {isPending ? '등록 중…' : '답글 등록'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
