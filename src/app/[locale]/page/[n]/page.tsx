import type { Metadata } from 'next';
import { ListPage, listMetadata } from '@/components/blog-index-route';

type Props = { params: Promise<{ locale: string; n: string }> };

// 전체글 2페이지 이후 (/ko/page/2). 홈과 같은 방식: 첫 요청 때 렌더링 → 캐시 (ISR)
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, n } = await params;
  return listMetadata(locale, { type: 'home' }, n);
}

export default async function HomePagedPage({ params }: Props) {
  const { locale, n } = await params;
  return <ListPage locale={locale} scope={{ type: 'home' }} n={n} />;
}
