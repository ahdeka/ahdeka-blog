import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import {
  PAGE_SIZE,
  countPublishedPosts,
  getCategories,
  getPopularTags,
  getPublishedPostPage,
  getTagWithPostIds,
  type PostListFilter,
} from '@/lib/posts';
import { getRecentComments } from '@/lib/comments/queries';
import { getPopularPosts } from '@/lib/views';
import { fill, formatDate } from '@/lib/format';
import PostList from './post-list';
import CategoryTabs from './category-tabs';
import TerminalPath, { type TerminalScope } from './terminal-path';
import { ProfileSidebar } from './profile';
import Pagination from './pagination';
import SearchForm from './search-form';
import LinkPending from './link-pending';

// 홈(전체글)·카테고리·태그·검색 화면이 같은 레이아웃을 씀
// 위: 터미널 경로 + 제목 + 카테고리 탭 / 아래: 글 목록 + 오른쪽 사이드바 (좁은 화면에서는 목록 아래로)
// 반환값이 null이면 없는 카테고리·태그(또는 공개 글이 없는 태그), 범위를 벗어난 페이지 → 호출한 쪽에서 notFound()
// search가 ''이면 검색어 입력 전 (목록 조회 없이 입력창만)
export type BlogIndexFilter = { category: string } | { tag: string } | { search: string };

export async function loadBlogIndex(locale: Locale, filter?: BlogIndexFilter, page = 1) {
  const categorySlug = filter && 'category' in filter ? filter.category : undefined;
  const tagSlug = filter && 'tag' in filter ? filter.tag : undefined;
  const search = filter && 'search' in filter ? filter.search : undefined;

  // 상위 카테고리면 하위 글까지 모아야 하므로 카테고리 목록을 먼저 읽음 (cache라 메타데이터와 공유)
  const [categories, tagged] = await Promise.all([getCategories(locale), tagSlug ? getTagWithPostIds(tagSlug) : null]);
  const current = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;
  if (categorySlug && !current) return null;
  if (tagSlug && !tagged?.postIds.length) return null;

  const listFilter: PostListFilter = current
    ? { categorySlugs: [current.slug, ...current.childSlugs] }
    : tagged
      ? { postIds: tagged.postIds }
      : search
        ? { search }
        : {};
  const [list, recent, popular, tags, allCount] = await Promise.all([
    search === '' ? { posts: [], total: 0 } : getPublishedPostPage(locale, listFilter, page),
    getRecentComments(3),
    getPopularPosts(locale, 5),
    getPopularTags(8),
    // 전체글 화면이면 목록의 전체 개수가 곧 "전체" 탭 숫자 → 추가 조회 없음
    filter ? countPublishedPosts() : null,
  ]);
  if (!list) return null;
  return {
    posts: list.posts,
    total: list.total,
    page,
    totalPages: Math.max(1, Math.ceil(list.total / PAGE_SIZE)),
    categories,
    recent,
    popular,
    tags,
    current,
    tag: tagged?.tag ?? null,
    search: search ?? null,
    allCount: allCount ?? list.total,
  };
}

type Props = {
  locale: Locale;
  dict: Dictionary;
  data: NonNullable<Awaited<ReturnType<typeof loadBlogIndex>>>;
};

export default function BlogIndex({ locale, dict, data }: Props) {
  const { posts, total, page, totalPages, categories, recent, popular, tags, current, tag, search, allCount } = data;
  // 하위 카테고리 화면이면 그 상위 (터미널 경로 "~/posts/dev/java")
  const parent = current?.depth === 1 ? categories.find((c) => c.childSlugs.includes(current.slug)) : undefined;

  // 페이지 주소: 목록은 /page/N 경로 (ISR 캐시 유지), 검색은 원래 요청마다 달라서 ?q=&page=N
  const base = current ? `/${locale}/category/${current.slug}` : tag ? `/${locale}/tag/${tag.slug}` : `/${locale}`;
  const pageHref = (n: number) =>
    search !== null
      ? `/${locale}/search?q=${encodeURIComponent(search)}${n > 1 ? `&page=${n}` : ''}`
      : n === 1
        ? base
        : `${base}/page/${n}`;

  const scope: TerminalScope =
    search !== null
      ? { type: 'search', q: search }
      : tag
        ? { type: 'tag', slug: tag.slug }
        : current
          ? { type: 'category', path: parent ? [parent, current] : [current] }
          : { type: 'home' };
  const isHome = scope.type === 'home';

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-6">
      {/* 위: 지금 위치(터미널 경로) + 제목. 홈은 짧은 소개 문구, 그 외에는 카테고리·태그 이름
          글 목록이 주인공이 되도록 홈 제목도 카테고리 제목과 같은 크기·여백 */}
      <header className="flex flex-col gap-2.5 pt-10 pb-7 sm:pt-12">
        <TerminalPath locale={locale} scope={scope} page={page} label={dict.post.breadcrumb} />
        {isHome ? (
          <h1 className="text-[26px] leading-[1.3] font-bold tracking-[-0.025em] sm:text-[30px]">
            {dict.home.headline}
          </h1>
        ) : (
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-[26px] leading-[1.3] font-bold tracking-[-0.025em] break-words sm:text-[30px]">
            {search !== null ? (
              dict.search.title
            ) : tag ? (
              <span>
                <span className="text-fg-3">#</span>
                {tag.name}
              </span>
            ) : (
              current?.name
            )}
            {search === null && <span className="mono text-base font-medium text-fg-3">{total}</span>}
          </h1>
        )}
      </header>

      {search !== null ? (
        <SearchForm
          locale={locale}
          defaultValue={search}
          labels={{ label: dict.search.title, placeholder: dict.search.placeholder, submit: dict.search.submit }}
        />
      ) : (
        <CategoryTabs
          locale={locale}
          categories={categories}
          // 태그 화면에서는 아무 탭도 선택 표시하지 않음 (null), 전체글이면 undefined
          current={tag ? null : current?.slug}
          allCount={allCount}
          labels={{ categories: dict.home.categories, subcategories: dict.home.subcategories, all: dict.home.all }}
        />
      )}

      <div className="flex flex-wrap items-start gap-x-16 gap-y-14">
        {/* 글 목록 */}
        <section className="min-w-0 flex-[999_1_560px]">
          {search === '' ? (
            <p className="py-10 text-fg-3">{dict.search.prompt}</p>
          ) : (
            <>
              {search !== null && (
                <h2 className="flex items-baseline gap-2.5 border-b border-line pb-4 text-lg font-bold tracking-[-0.015em] break-words">
                  {fill(dict.search.results, { q: search })}
                  <span className="mono text-sm font-medium text-fg-3">{total}</span>
                </h2>
              )}
              <PostList
                locale={locale}
                posts={posts}
                emptyText={search !== null ? dict.search.empty : dict.home.empty}
                commentCountLabel={dict.home.commentCount}
                viewCountLabel={dict.post.views}
                currentCategory={current ? { slug: current.slug, hasChildren: current.childSlugs.length > 0 } : undefined}
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                href={pageHref}
                labels={{ nav: dict.pagination.label, prev: dict.pagination.prev, next: dict.pagination.next, page: dict.pagination.page }}
              />
            </>
          )}
        </section>

        {/* 오른쪽: 프로필 / TOP 5 / 태그 / 최근 댓글 (내용이 없는 칸은 통째로 빠짐) */}
        <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-10 lg:max-w-[280px] lg:pt-8">
          <ProfileSidebar locale={locale} dict={dict} />
          {popular.length > 0 && (
            <section className="flex flex-col">
              <h2 className="mb-2 text-[15px] font-bold">{dict.home.popular}</h2>
              <ol className="flex flex-col">
                {popular.map((p, i) => (
                  <li key={p.number}>
                    <Link href={`/${locale}/posts/${p.number}`} className="group flex items-baseline gap-3 py-2">
                      <LinkPending />
                      {/* 1~3위는 강조색 */}
                      <span className={`mono w-4 shrink-0 text-sm font-bold ${i < 3 ? 'text-accent-fg' : 'text-fg-3'}`}>{i + 1}</span>
                      <span className="clamp2 flex-1 text-sm leading-[1.6] font-medium group-hover:text-accent-fg">{p.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {tags.length > 0 && (
            <section className="flex flex-col">
              <h2 className="mb-3.5 text-[15px] font-bold">{dict.post.tags}</h2>
              <ul className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/${locale}/tag/${t.slug}`}
                      aria-current={tag?.slug === t.slug ? 'page' : undefined}
                      className="inline-flex h-8 items-center rounded-full bg-subtle px-3 text-[13px] text-fg-2 transition-colors hover:text-accent-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-fg"
                    >
                      <LinkPending />
                      <span className="text-fg-3">#</span>
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recent.length > 0 && (
            <section className="flex flex-col">
              <h2 className="mb-2 text-[15px] font-bold">{dict.home.recentComments}</h2>
              {recent.map((c) => (
                <Link key={c.id} href={`/${locale}/posts/${c.postNumber}#comment-${c.id}`} className="group flex flex-col gap-1 py-2.5">
                  <LinkPending />
                  <span className="clamp2 text-sm leading-[1.6] group-hover:text-accent-fg">{c.body}</span>
                  <span className="text-[12.5px] text-fg-3">
                    {c.nickname || dict.comments.anonymous} · <span className="mono">{formatDate(c.createdAt)}</span>
                  </span>
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
