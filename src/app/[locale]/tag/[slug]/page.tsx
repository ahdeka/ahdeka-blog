import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getTagWithPostIds } from '@/lib/posts';
import { isTagSlug } from '@/lib/tags';
import BlogIndex, { loadBlogIndex } from '@/components/blog-index';

type Props = { params: Promise<{ locale: string; slug: string }> };

// 카테고리 화면과 같은 방식: 첫 요청 때 렌더링 → 캐시 (ISR). 글·태그 저장 시 revalidatePath로 갱신
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isTagSlug(slug)) return {};
  const tagged = await getTagWithPostIds(slug);
  if (!tagged?.postIds.length) return {};
  return {
    title: `#${tagged.tag.name}`,
    alternates: {
      canonical: `/${locale}/tag/${slug}`,
      languages: { ja: `/ja/tag/${slug}`, ko: `/ko/tag/${slug}`, 'x-default': `/ja/tag/${slug}` },
    },
  };
}

export default async function TagPage({ params }: Props) {
  const { locale, slug } = await params;
  // DB 제약(tags.slug)과 같은 형식만 조회
  if (!isLocale(locale) || !isTagSlug(slug)) notFound();

  const [dict, data] = await Promise.all([getDictionary(locale), loadBlogIndex(locale, { tag: slug })]);
  if (!data) notFound();

  return <BlogIndex locale={locale} dict={dict} data={data} />;
}
