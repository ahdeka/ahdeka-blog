import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getPublishedPost } from '@/lib/posts';
import MarkdownView from '@/components/markdown-view';

type Props = { params: Promise<{ locale: string; number: string }> };

// 빌드 시 미리 만들지 않고, 첫 요청 때 렌더링 → 캐시 (ISR)
export function generateStaticParams() {
  return [];
}
// ⚠️ [locale] 레이아웃의 dynamicParams = false 가 상속되어 새 글이 404가 되던 버그 수정
export const dynamicParams = true;
export const revalidate = 86400;

// "12" 같은 양의 정수만 허용. 그 외(/posts/abc)는 DB 조회 없이 바로 404
function parseNumber(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, number } = await params;
  const n = parseNumber(number);
  if (!n || !isLocale(locale)) return {};

  const post = await getPublishedPost(n, locale);
  if (!post) return {};

  return {
    title: post.title,
    description: post.summary ?? undefined,
    // 공개된 글은 항상 KO·JA 둘 다 있으므로 hreflang을 고정으로 연결
    alternates: {
      canonical: `/${locale}/posts/${n}`,
      languages: { ja: `/ja/posts/${n}`, ko: `/ko/posts/${n}`, 'x-default': `/ja/posts/${n}` },
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { locale, number } = await params;
  const n = parseNumber(number);
  if (!n || !isLocale(locale)) notFound();

  const post = await getPublishedPost(n, locale);
  if (!post) notFound();

  const dateFormat = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Tokyo',
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article>
        <header className="mb-10">
          <time className="text-sm text-neutral-500">{dateFormat.format(new Date(post.publishedAt))}</time>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{post.title}</h1>
        </header>
        <MarkdownView content={post.content} />
      </article>
    </main>
  );
}