import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCategories } from '@/lib/posts';
import BlogIndex, { loadBlogIndex } from '@/components/blog-index';

type Props = { params: Promise<{ locale: string; slug: string }> };

// 글 상세와 같은 방식: 첫 요청 때 렌더링 → 캐시 (ISR). 글 저장·댓글 등록 시 revalidatePath로 갱신
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

// DB 제약(categories.slug)과 같은 형식만 조회
const isSlug = (v: string) => /^[a-z0-9-]{1,100}$/.test(v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isSlug(slug)) return {};
  const category = (await getCategories(locale)).find((c) => c.slug === slug);
  if (!category) return {};
  return {
    title: category.name,
    alternates: {
      canonical: `/${locale}/category/${slug}`,
      languages: { ja: `/ja/category/${slug}`, ko: `/ko/category/${slug}`, 'x-default': `/ja/category/${slug}` },
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isSlug(slug)) notFound();

  const [dict, data] = await Promise.all([getDictionary(locale), loadBlogIndex(locale, { category: slug })]);
  if (!data) notFound();

  return <BlogIndex locale={locale} dict={dict} data={data} />;
}
