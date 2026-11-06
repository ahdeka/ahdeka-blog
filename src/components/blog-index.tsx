import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { countPublishedPosts, getCategories, getPublishedPosts } from '@/lib/posts';
import { getRecentComments } from '@/lib/comments/queries';
import { formatDate } from '@/lib/format';
import PostList from './post-list';
import { ProfileSidebar } from './profile';

// 홈(전체글)과 카테고리 페이지가 같은 3단 레이아웃을 씀
// 반환값이 null이면 없는 카테고리 → 호출한 쪽에서 notFound()
export async function loadBlogIndex(locale: Locale, categorySlug?: string) {
  const [posts, categories, recent, allCount] = await Promise.all([
    getPublishedPosts(locale, { categorySlug }),
    getCategories(locale),
    getRecentComments(3),
    // 전체글 화면이면 목록 길이가 곧 전체 개수 → 추가 조회 없음
    categorySlug ? countPublishedPosts() : null,
  ]);
  const current = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;
  if (categorySlug && !current) return null;
  return { posts, categories, recent, current, allCount: allCount ?? posts.length };
}

type Props = {
  locale: Locale;
  dict: Dictionary;
  categorySlug?: string; // 없으면 전체글
  data: NonNullable<Awaited<ReturnType<typeof loadBlogIndex>>>;
};

export default function BlogIndex({ locale, dict, categorySlug, data }: Props) {
  const { posts, categories, recent, current, allCount } = data;

  return (
    <main className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-12 px-4 pt-10 pb-20 sm:px-8">
      {/* 왼쪽: 프로필 + 카테고리 */}
      <aside className="flex min-w-0 flex-[1_1_232px] flex-col gap-7 lg:max-w-[248px]">
        <ProfileSidebar dict={dict} />
        <nav aria-label={dict.home.categories} className="flex flex-col gap-1 border-t border-line pt-6">
          <span className="px-2.5 pb-2 text-xs font-semibold tracking-[0.06em] text-fg-3">{dict.home.categories}</span>
          <Link href={`/${locale}`} aria-current={!categorySlug ? 'page' : undefined} className="tree-item">
            <span className="flex-1">{dict.home.all}</span>
            <span className="mono text-xs opacity-85">{allCount}</span>
          </Link>
          {categories
            .filter((c) => c.count > 0)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/${locale}/category/${c.slug}`}
                aria-current={c.slug === categorySlug ? 'page' : undefined}
                className="tree-item"
              >
                <span className="flex-1">{c.name}</span>
                <span className="mono text-xs text-fg-3">{c.count}</span>
              </Link>
            ))}
        </nav>
      </aside>

      {/* 가운데: 글 목록 */}
      <section className="min-w-0 flex-[999_1_560px]">
        <div className="flex items-baseline gap-2.5 border-b border-fg pb-[18px]">
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">{current?.name ?? dict.home.all}</h1>
          <span className="mono text-sm text-fg-3">{posts.length}</span>
        </div>
        <PostList locale={locale} posts={posts} emptyText={dict.home.empty} commentCountLabel={dict.home.commentCount} />
      </section>

      {/* 오른쪽: 최근 댓글 */}
      <aside className="flex min-w-0 flex-[1_1_248px] flex-col gap-9 lg:max-w-[272px]">
        {recent.length > 0 && (
          <section className="flex flex-col gap-1">
            <h2 className="mb-2.5 text-base font-bold">{dict.home.recentComments}</h2>
            {recent.map((c) => (
              <Link key={c.id} href={`/${locale}/posts/${c.postNumber}#comment-${c.id}`} className="group flex flex-col gap-1 py-2.5">
                <span className="clamp2 text-sm leading-[1.6] group-hover:text-accent-fg">{c.body}</span>
                <span className="text-[12.5px] text-fg-3">
                  {c.nickname} · <span className="mono">{formatDate(c.createdAt)}</span>
                </span>
              </Link>
            ))}
          </section>
        )}
      </aside>
    </main>
  );
}
