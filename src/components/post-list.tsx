import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { PublicPostSummary } from '@/lib/posts';
import { fill, formatDate } from '@/lib/format';
import { ClockIcon, CommentIcon } from './meta-icons';
import { ListViewCount } from './view-count';

type Props = {
  locale: Locale;
  posts: PublicPostSummary[];
  emptyText: string;
  commentCountLabel: string; // "댓글 {n}개" — 화면 낭독기용
  viewCountLabel: string; // "조회 {n}" — 화면 낭독기용 (화면에는 눈 아이콘 + 숫자만)
  // 카테고리 화면이면 그 카테고리. 화면 제목과 겹치는 경로는 카드에서 뺌
  // - 전체글·태그(없음): "개발 › Java" 전체 경로
  // - 하위가 있는 카테고리: 하위 이름만 ("Java"), 그 카테고리에 직접 속한 글은 빈 줄
  // - 하위가 없는 카테고리: 모든 카드가 같은 값이므로 카테고리 줄 자체를 없앰
  currentCategory?: { slug: string; hasChildren: boolean };
};

export default function PostList({ locale, posts, emptyText, commentCountLabel, viewCountLabel, currentCategory }: Props) {
  const showCategoryRow = !currentCategory || currentCategory.hasChildren;
  if (posts.length === 0) {
    return <p className="py-10 text-fg-3">{emptyText}</p>;
  }

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.number} className="border-b border-line">
          {/* 카드 높이·썸네일 위치가 글마다 흔들리지 않도록:
              카테고리 줄은 (보이는 화면이면) 값이 없어도 자리 유지, 요약은 짧아도 2줄 높이, 썸네일은 세로 가운데 */}
          <Link href={`/${locale}/posts/${post.number}`} className="group flex items-center gap-5 py-6 sm:gap-7">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {showCategoryRow && <CategoryLabel category={post.category} current={currentCategory?.slug} />}
              <h2 className="clamp2 text-[20px] leading-(--lh-title) font-semibold tracking-[-0.015em] text-fg transition-colors group-hover:text-accent-fg">
                {post.title}
              </h2>
              <p className="clamp2 min-h-[3.4em] text-[15px] leading-[1.7] text-fg-2">{post.summary}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <ClockIcon />
                  <time dateTime={post.publishedAt} className="mono">
                    {formatDate(post.publishedAt)}
                  </time>
                </span>
                {/* 이 탭에서 연 글이면 최신 값 (뒤로가기 시 글 화면과 같은 숫자) */}
                <ListViewCount number={post.number} initial={post.viewCount} label={viewCountLabel} />
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
                className="aspect-[3/2] w-24 shrink-0 rounded-[10px] border border-line object-cover sm:w-[168px]"
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 카테고리 줄 (높이 고정: 표시할 게 없어도 같은 높이를 차지 → 썸네일 위치 고정)
function CategoryLabel({ category, current }: { category: PublicPostSummary['category']; current?: string }) {
  // 지금 보고 있는 카테고리에 직접 속한 글 → 화면 제목과 같으므로 빈 줄
  if (!category || category.slug === current) return <span className="h-5" aria-hidden="true" />;
  // 상위 카테고리 화면에서는 상위 이름이 화면 제목과 겹치므로 하위 이름만
  const parent = current ? null : category.parent;
  return (
    <span className="flex h-5 items-center gap-1 text-[13px] font-semibold text-accent-fg">
      {parent && (
        <>
          <span className="font-medium text-fg-3">{parent.name}</span>
          {/* 카테고리 이름 안의 "·"(예: Java · Spring)와 헷갈리지 않도록 경로 구분자는 › */}
          <span aria-hidden="true" className="text-fg-3">›</span>
        </>
      )}
      {category.name}
    </span>
  );
}
