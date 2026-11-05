import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getPublishedPosts } from '@/lib/posts';

// 1시간마다 백그라운드에서 갱신. 글 저장 시에는 revalidatePath로 즉시 갱신할 예정
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  return {
    title: dict.posts.title,
    alternates: {
      canonical: `/${locale}/posts`,
      languages: { ja: '/ja/posts', ko: '/ko/posts', 'x-default': '/ja/posts' },
    },
  };
}

export default async function PostsPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const [dict, posts] = await Promise.all([getDictionary(locale), getPublishedPosts(locale)]);

  // Vercel 서버는 UTC라서 시간대를 명시하지 않으면 날짜가 하루 어긋날 수 있음
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Asia/Tokyo' });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{dict.posts.title}</h1>

      {posts.length === 0 ? (
        <p className="mt-8 text-neutral-500">{dict.posts.empty}</p>
      ) : (
        <ul className="mt-8 space-y-10">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/${locale}/posts/${post.slug}`} className="group block">
                <div className="flex gap-3 text-sm text-neutral-500">
                  <time dateTime={post.publishedAt}>
                    {dateFormat.format(new Date(post.publishedAt))}
                  </time>
                  {post.category && <span>{post.category.name}</span>}
                </div>
                <h2 className="mt-1 text-xl font-semibold group-hover:underline">{post.title}</h2>
                {post.summary && (
                  <p className="mt-2 text-neutral-600 dark:text-neutral-400">{post.summary}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}