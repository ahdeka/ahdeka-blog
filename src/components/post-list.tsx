import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { PublicPostSummary } from '@/lib/posts';
import { fill, formatDate } from '@/lib/format';
import { ClockIcon, CommentIcon, EyeIcon } from './meta-icons';

type Props = {
  locale: Locale;
  posts: PublicPostSummary[];
  emptyText: string;
  commentCountLabel: string; // "댓글 {n}개" — 화면 낭독기용
  viewCountLabel: string; // "조회 {n}" — 화면 낭독기용 (화면에는 눈 아이콘 + 숫자만)
};

export default function PostList({ locale, posts, emptyText, commentCountLabel, viewCountLabel }: Props) {
  if (posts.length === 0) {
    return <p className="py-10 text-fg-3">{emptyText}</p>;
  }

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.number} className="border-b border-line">
          <Link href={`/${locale}/posts/${post.number}`} className="group flex items-start gap-5 py-7 sm:gap-7">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              {post.category && (
                <span className="flex items-center gap-1 text-[13px] font-semibold text-accent-fg">
                  {post.category.parent && (
                    <>
                      <span className="font-medium text-fg-3">{post.category.parent.name}</span>
                      {/* 카테고리 이름 안의 "·"(예: Java · Spring)와 헷갈리지 않도록 경로 구분자는 › */}
                      <span aria-hidden="true" className="text-fg-3">›</span>
                    </>
                  )}
                  {post.category.name}
                </span>
              )}
              <h2 className="clamp2 text-[21px] leading-(--lh-title) font-semibold tracking-[-0.015em] text-fg transition-colors group-hover:text-accent-fg">
                {post.title}
              </h2>
              {post.summary && <p className="clamp2 text-[15px] leading-[1.7] text-fg-2">{post.summary}</p>}
              <div className="mt-1 flex items-center gap-4 text-[13px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <ClockIcon />
                  <time dateTime={post.publishedAt} className="mono">
                    {formatDate(post.publishedAt)}
                  </time>
                </span>
                <span className="flex items-center gap-1.5" aria-label={fill(viewCountLabel, { n: post.viewCount })}>
                  <EyeIcon />
                  <span className="mono" aria-hidden="true">{post.viewCount.toLocaleString('en-US')}</span>
                </span>
                <span className="flex items-center gap-1.5" aria-label={fill(commentCountLabel, { n: post.commentCount })}>
                  <CommentIcon />
                  <span className="mono" aria-hidden="true">{post.commentCount}</span>
                </span>
              </div>
            </div>
            {post.cover && (
              // 썸네일: 제목이 이미 링크 이름이므로 alt는 비움 (장식)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.cover.url}
                alt=""
                width={post.cover.width}
                height={post.cover.height}
                loading="lazy"
                decoding="async"
                className="mt-1 aspect-[3/2] w-24 shrink-0 rounded-[10px] border border-line object-cover sm:w-[168px]"
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
