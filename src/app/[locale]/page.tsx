import { ListPage } from '@/components/blog-index-route';

// 글 저장·댓글 등록 시 revalidatePath로 즉시 갱신. 이 값은 혹시 모를 경우를 위한 안전망(하루)
export const revalidate = 86400;

// metadata는 layout의 기본값(사이트 제목, canonical `/${locale}`, hreflang)을 그대로 사용

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ListPage locale={locale} scope={{ type: 'home' }} />;
}
