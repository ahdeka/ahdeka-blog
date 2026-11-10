import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/lib/format';
import { normalizeSearch } from '@/lib/search';
import { parsePageParam } from '@/lib/paging';
import BlogIndex, { loadBlogIndex } from '@/components/blog-index';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// searchParams를 읽으므로 요청마다 렌더링 (검색 결과는 캐시하지 않음)
// 검색 결과 화면은 검색엔진 색인에서 제외 (글 자체는 목록·sitemap으로 수집됨)
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, q] = await Promise.all([getDictionary(locale), searchParams.then((sp) => normalizeSearch(sp.q))]);
  return {
    title: q ? fill(dict.search.results, { q }) : dict.search.title,
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const q = normalizeSearch(sp.q);
  const p = parsePageParam(sp.page);
  if (!p) notFound();

  const [dict, data] = await Promise.all([
    getDictionary(locale),
    loadBlogIndex(locale, { search: q }, p.kind === 'page' && q ? p.n : 1),
  ]);
  if (!data) notFound();

  return <BlogIndex locale={locale} dict={dict} data={data} />;
}
