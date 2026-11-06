import { notFound, permanentRedirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';

// 글 목록은 홈(/ja, /ko)으로 합침. 예전 주소로 들어온 경우를 위해 308로 이동
export default async function PostListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  permanentRedirect(`/${locale}`);
}
