import type { Metadata } from 'next';
import { ListPage, listMetadata } from '@/components/blog-index-route';

type Props = { params: Promise<{ locale: string; slug: string; n: string }> };

// 2페이지 이후 (/ko/tag/{slug}/page/2). 1페이지와 같은 방식: 첫 요청 때 렌더링 → 캐시 (ISR)
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, n } = await params;
  return listMetadata(locale, { type: 'tag', slug }, n);
}

export default async function TagPagedPage({ params }: Props) {
  const { locale, slug, n } = await params;
  return <ListPage locale={locale} scope={{ type: 'tag', slug }} n={n} />;
}
