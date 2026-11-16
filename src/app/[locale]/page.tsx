import { ListPage } from '@/components/blog-index-route';

// 글 저장·댓글 등록 시 revalidatePath로 즉시 갱신
// 10분: 조회수·인기 글 TOP5는 조회 때 캐시를 갱신하지 않으므로 이 주기로 반영 (stale-while-revalidate → 방문자 응답 속도는 그대로)
export const revalidate = 600;

// metadata는 layout의 기본값(사이트 제목, canonical `/${locale}`, hreflang)을 그대로 사용

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ListPage locale={locale} scope={{ type: 'home' }} />;
}
