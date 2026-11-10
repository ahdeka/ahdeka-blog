'use client';

import { useState } from 'react';
import { CommentIcon } from '../meta-icons';

type Props = {
  heading: string;
  count: number;
  labels: { sort: string; oldest: string; newest: string; empty: string };
  form: React.ReactNode;
  threads: { id: string; node: React.ReactNode }[]; // 서버에서 그린 스레드 (등록순)
};

// 정렬(등록순/최신순)만 브라우저에서 처리. 댓글 내용은 서버 렌더링 그대로 → ISR 캐시 유지
export default function CommentBoard({ heading, count, labels, form, threads }: Props) {
  const [newest, setNewest] = useState(false);
  const ordered = newest ? [...threads].reverse() : threads;

  return (
    <>
      <div className="flex items-center justify-between border-b border-fg pb-5">
        <h2 id="comments-heading" className="flex items-center gap-2 text-xl font-bold">
          <CommentIcon size={24} className="text-fg-2" />
          {heading} <span className="mono text-accent-fg">{count}</span>
        </h2>
        {threads.length > 1 && (
          <div role="group" aria-label={labels.sort} className="flex gap-1 text-[13.5px]">
            <button type="button" className="act m-0" aria-pressed={!newest} onClick={() => setNewest(false)}>
              {labels.oldest}
            </button>
            <button type="button" className="act m-0" aria-pressed={newest} onClick={() => setNewest(true)}>
              {labels.newest}
            </button>
          </div>
        )}
      </div>

      {/* 댓글을 먼저 읽고 → 아래에서 작성하는 흐름 */}
      {threads.length === 0 ? (
        <p className="py-7 text-sm text-fg-3">{labels.empty}</p>
      ) : (
        <ol>
          {ordered.map((t) => (
            <li key={t.id} id={`comment-${t.id}`} className="flex scroll-mt-24 flex-col gap-[22px] border-b border-line py-7">
              {t.node}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8">{form}</div>
    </>
  );
}
