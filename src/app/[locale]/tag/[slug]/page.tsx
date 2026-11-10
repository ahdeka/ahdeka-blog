import type { Metadata } from 'next';
import { ListPage, listMetadata } from '@/components/blog-index-route';

type Props = { params: Promise<{ locale: string; slug: string }> };

// 글 상세와 같은 방식: 첫 요청 때 렌더링 → 캐시 (ISR). 글 저장·댓글 등록 시 revalidatePath로 갱신
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return listMetadata(locale, { type: 'tag', slug });
}

export default async function TagPage({ params }: Props) {
  const { locale, slug } = await params;
  return <ListPage locale={locale} scope={{ type: 'tag', slug }} />;
}
