import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCategories, getTagWithPostIds } from '@/lib/posts';
import { isTagSlug } from '@/lib/tags';
import { fill } from '@/lib/format';
import { parsePageParam } from '@/lib/paging';
import BlogIndex, { loadBlogIndex, type BlogIndexFilter } from './blog-index';

// 홈·카테고리·태그 목록과 그 2페이지 이후(/page/[n]) 라우트가 공통으로 쓰는 처리
// (page.tsx 파일은 정해진 이름만 export할 수 있어서 여기에 모음)
export type ListScope = { type: 'home' } | { type: 'category'; slug: string } | { type: 'tag'; slug: string };

// DB 제약(categories.slug)과 같은 형식만 조회
const isCategorySlug = (v: string) => /^[a-z0-9-]{1,100}$/.test(v);

const validScope = (s: ListScope) =>
  s.type === 'home' || (s.type === 'category' ? isCategorySlug(s.slug) : isTagSlug(s.slug));

// 언어 부분을 뺀 주소 ("", "/category/dev", "/tag/java")
const scopePath = (s: ListScope) => (s.type === 'home' ? '' : `/${s.type}/${s.slug}`);

const toFilter = (s: ListScope): BlogIndexFilter | undefined =>
  s.type === 'category' ? { category: s.slug } : s.type === 'tag' ? { tag: s.slug } : undefined;

// 1페이지 라우트는 n 없이, /page/[n] 라우트는 n 문자열 그대로
function pageNumber(n: string | undefined): number | null {
  if (n === undefined) return 1;
  const p = parsePageParam(n);
  return p?.kind === 'page' ? p.n : null;
}

export async function listMetadata(rawLocale: string, scope: ListScope, n?: string): Promise<Metadata> {
  if (!isLocale(rawLocale) || !validScope(scope)) return {};
  const locale: Locale = rawLocale;
  const page = pageNumber(n);
  if (!page) return {};

  let name: string | null = null;
  if (scope.type === 'category') {
    const category = (await getCategories(locale)).find((c) => c.slug === scope.slug);
    if (!category) return {};
    name = category.name;
  } else if (scope.type === 'tag') {
    const tagged = await getTagWithPostIds(scope.slug);
    if (!tagged?.postIds.length) return {};
    name = `#${tagged.tag.name}`;
  }
  // 홈 1페이지는 layout의 기본값(사이트 제목, canonical, hreflang) 그대로
  if (scope.type === 'home' && page === 1) return {};

  const dict = await getDictionary(locale);
  const pageLabel = page > 1 ? fill(dict.pagination.page, { n: page }) : null;
  const path = `${scopePath(scope)}${page > 1 ? `/page/${page}` : ''}`;
  return {
    title: [name, pageLabel].filter(Boolean).join(' · '),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ja: `/ja${path}`, ko: `/ko${path}`, 'x-default': `/ja${path}` },
    },
  };
}

export async function ListPage({ locale, scope, n }: { locale: string; scope: ListScope; n?: string }) {
  if (!isLocale(locale) || !validScope(scope)) notFound();
  // /page/1 은 기본 주소와 같은 화면 → 기본 주소로 (주소 하나로 통일)
  if (n !== undefined && parsePageParam(n)?.kind === 'first') permanentRedirect(`/${locale}${scopePath(scope)}`);
  const page = pageNumber(n);
  if (!page) notFound();

  const [dict, data] = await Promise.all([getDictionary(locale), loadBlogIndex(locale, toFilter(scope), page)]);
  if (!data) notFound();

  return <BlogIndex locale={locale} dict={dict} data={data} />;
}
