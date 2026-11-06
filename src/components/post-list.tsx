import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { PublicPostSummary } from '@/lib/posts';
import { fill, formatDate } from '@/lib/format';

type Props = {
  locale: Locale;
  posts: PublicPostSummary[];
  emptyText: string;
  commentCountLabel: string; // "댓글 {n}개" — 화면 낭독기용
};

export default function PostList({ locale, posts, emptyText, commentCountLabel }: Props) {
  if (posts.length === 0) {
    return <p className="py-10 text-fg-3">{emptyText}</p>;
  }

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.number} className="border-b border-line">
          <Link href={`/${locale}/posts/${post.number}`} className="group flex flex-col gap-2.5 py-7">
            {post.category && <span className="text-[13px] font-semibold text-accent-fg">{post.category.name}</span>}
            <h2 className="clamp2 text-[21px] leading-(--lh-title) font-semibold tracking-[-0.015em] text-fg transition-colors group-hover:text-accent-fg">
              {post.title}
            </h2>
            {post.summary && <p className="clamp2 text-[15px] leading-[1.7] text-fg-2">{post.summary}</p>}
            <div className="mt-1 flex items-center gap-4 text-[13px] text-fg-3">
              <time dateTime={post.publishedAt} className="mono">
                {formatDate(post.publishedAt)}
              </time>
              <span className="flex items-center gap-1.5" aria-label={fill(commentCountLabel, { n: post.commentCount })}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-4.7A8 8 0 1 1 21 12Z" />
                </svg>
                <span className="mono" aria-hidden="true">{post.commentCount}</span>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
