import { isLocale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { postOgImage, postOgVersion } from '@/lib/og';
import { getPublishedPost } from '@/lib/posts';

// 커버 이미지가 없는 글의 공유 이미지: /ko/posts/12/og/{버전}
// 첫 요청 때 생성 → 캐시 (ISR). 버전은 글 수정 시각이라 수정하면 URL 자체가 바뀜
// 현재 버전이 아닌 주소는 404 (아무 값이나 넣어 캐시를 늘리는 요청 차단)
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

type Params = { locale: string; number: string; v: string };

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { locale, number, v } = await params;
  if (!isLocale(locale) || !/^[1-9]\d{0,14}$/.test(number)) return new Response('Not Found', { status: 404 });

  const post = await getPublishedPost(Number(number), locale);
  if (!post || postOgVersion(post.updatedAt) !== v) return new Response('Not Found', { status: 404 });

  return postOgImage({
    title: post.title,
    category: post.category ? { name: post.category.name, parent: post.category.parent?.name ?? null } : null,
    date: formatDate(post.publishedAt),
  });
}
