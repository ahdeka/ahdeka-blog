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
import CategoryTree from './category-tree';
import { ProfileSidebar } from './profile';
import Pagination from './pagination';
import SearchForm from './search-form';

// 홈(전체글)·카테고리·태그·검색 화면이 같은 3단 레이아웃을 씀
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
    // 전체글 화면이면 목록의 전체 개수가 곧 "전체글" 숫자 → 추가 조회 없음
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
  // 하위 카테고리 화면이면 제목 위에 상위 경로 ("개발 ›")
  const parent = current?.depth === 1 ? categories.find((c) => c.childSlugs.includes(current.slug)) : undefined;

  // 페이지 주소: 목록은 /page/N 경로 (ISR 캐시 유지), 검색은 원래 요청마다 달라서 ?q=&page=N
  const base = current ? `/${locale}/category/${current.slug}` : tag ? `/${locale}/tag/${tag.slug}` : `/${locale}`;
  const pageHref = (n: number) =>
    search !== null
      ? `/${locale}/search?q=${encodeURIComponent(search)}${n > 1 ? `&page=${n}` : ''}`
      : n === 1
        ? base
        : `${base}/page/${n}`;

  return (
    <main className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-12 px-4 pt-10 pb-20 sm:px-8">
      {/* 왼쪽: 프로필 + 카테고리 */}
      <aside className="flex min-w-0 flex-[1_1_232px] flex-col gap-7 lg:max-w-[248px]">
        <ProfileSidebar locale={locale} dict={dict} />
        <CategoryTree
          locale={locale}
          categories={categories}
          // 태그·검색 화면에서는 아무 항목도 선택 표시하지 않음 (null), 전체글이면 undefined
          current={tag || search !== null ? null : current?.slug}
          allCount={allCount}
          labels={{ categories: dict.home.categories, all: dict.home.all, toggle: dict.home.toggleCategory }}
        />
      </aside>

      {/* 가운데: 글 목록 */}
      <section className="min-w-0 flex-[999_1_560px]">
        {parent && (
          <Link
            href={`/${locale}/category/${parent.slug}`}
            className="mb-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-fg-3 transition-colors hover:text-accent-fg"
          >
            {parent.name}
            <span aria-hidden="true">›</span>
          </Link>
        )}
        {search !== null && (
          <SearchForm
            locale={locale}
            defaultValue={search}
            labels={{ label: dict.search.title, placeholder: dict.search.placeholder, submit: dict.search.submit }}
          />
        )}
        {search === '' ? (
          <p className="py-10 text-fg-3">{dict.search.prompt}</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2.5 border-b border-fg pb-[18px]">
              <h1 className="min-w-0 text-[26px] font-bold tracking-[-0.02em] break-words">
                {search !== null ? (
                  fill(dict.search.results, { q: search })
                ) : tag ? (
                  <>
                    <span className="text-fg-3">#</span>
                    {tag.name}
                  </>
                ) : (
                  (current?.name ?? dict.home.all)
                )}
              </h1>
              <span className="mono text-sm text-fg-3">{total}</span>
            </div>
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

      {/* 오른쪽: TOP 5 / 태그 / 최근 댓글 (사이마다 구분선, 내용이 없는 칸은 통째로 빠짐) */}
      <aside className="flex min-w-0 flex-[1_1_248px] flex-col divide-y divide-line lg:max-w-[272px] [&>section]:py-7 [&>section:first-child]:pt-0">
        {popular.length > 0 && (
          <section className="flex flex-col">
            <h2 className="mb-2.5 text-base font-bold">{dict.home.popular}</h2>
            <ol className="flex flex-col">
              {popular.map((p, i) => (
                <li key={p.number}>
                  <Link href={`/${locale}/posts/${p.number}`} className="group flex items-baseline gap-3 py-2">
                    {/* 1~3위는 강조색 */}
                    <span className={`mono w-4 shrink-0 text-sm font-bold ${i < 3 ? 'text-accent-fg' : 'text-fg-3'}`}>{i + 1}</span>
                    <span className="clamp2 flex-1 text-sm leading-[1.6] group-hover:text-accent-fg">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
        {tags.length > 0 && (
          <section className="flex flex-col">
            <h2 className="mb-3.5 text-base font-bold">{dict.post.tags}</h2>
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/${locale}/tag/${t.slug}`}
                    aria-current={tag?.slug === t.slug ? 'page' : undefined}
                    className="inline-flex h-[30px] items-center rounded-full border border-line px-3 text-[12.5px] text-fg-2 transition-colors hover:border-accent hover:text-accent-fg aria-[current=page]:border-accent aria-[current=page]:text-accent-fg"
                  >
                    <span className="text-fg-3">#</span>
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {recent.length > 0 && (
          <section className="flex flex-col gap-1">
            <h2 className="mb-2.5 text-base font-bold">{dict.home.recentComments}</h2>
            {recent.map((c) => (
              <Link key={c.id} href={`/${locale}/posts/${c.postNumber}#comment-${c.id}`} className="group flex flex-col gap-1 py-2.5">
                <span className="clamp2 text-sm leading-[1.6] group-hover:text-accent-fg">{c.body}</span>
                <span className="text-[12.5px] text-fg-3">
                  {c.nickname || dict.comments.anonymous} ·<span className="mono">{formatDate(c.createdAt)}</span>
                </span>
              </Link>
            ))}
          </section>
        )}
      </aside>
    </main>
  );
}
