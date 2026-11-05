import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getAllPublishedSlugs, getPost, getPublishedLocales } from '@/lib/posts';

export const revalidate = 3600;
// 빌드 이후에 새로 쓴 글도 첫 접속 시 생성 후 캐싱 (상위 레이아웃 설정을 덮어씀)
export const dynamicParams = true;

type Props = { params: Promise<{ locale: string; slug: string }> };

// slug 형식이 아니면 DB 조회 없이 바로 404 (불필요한 DB 호출 방지)
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const all = await getAllPublishedSlugs();
  return all.filter((p) => p.locale === params.locale).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!SLUG_PATTERN.test(slug)) return {};

  const [post, locales] = await Promise.all([
    getPost(locale as Locale, slug),
    getPublishedLocales(slug),
  ]);
  if (!post) return {};

  // hreflang: 실제로 공개된 번역끼리만 연결
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `/${l}/posts/${slug}`;
  if (locales.includes('ja')) languages['x-default'] = `/ja/posts/${slug}`;

  return {
    title: post.title,
    description: post.summary ?? undefined,
    alternates: { canonical: `/${locale}/posts/${slug}`, languages },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.summary ?? undefined,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!SLUG_PATTERN.test(slug)) notFound();

  const locale = raw as Locale;
  const [dict, post] = await Promise.all([getDictionary(locale), getPost(locale, slug)]);
  if (!post) notFound();

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Asia/Tokyo' });
  const isUpdated = post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article>
        <header>
          <div className="flex flex-wrap gap-3 text-sm text-neutral-500">
            <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>
            {isUpdated && (
              <span>
                {dict.posts.updated}: {dateFormat.format(new Date(post.updatedAt))}
              </span>
            )}
            {post.category && <span>{post.category.name}</span>}
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{post.title}</h1>
        </header>

        {/*
          보안: react-markdown은 기본적으로 Markdown 안의 생 HTML(<script> 등)을 렌더링하지 않음.
          rehype-raw 플러그인은 XSS 위험이 있으므로 추가하지 말 것.
        */}
        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}