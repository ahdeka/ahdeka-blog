import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getPublishedPosts } from '@/lib/posts';
import PostList from '@/components/post-list';

// 글 저장 시 revalidatePath로 즉시 갱신. 이 값은 혹시 모를 경우를 위한 안전망(하루)
export const revalidate = 86400;

// metadata는 layout의 기본값(사이트 제목, canonical `/${locale}`, hreflang)을 그대로 사용

const LATEST_COUNT = 5;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, posts] = await Promise.all([
    getDictionary(locale),
    getPublishedPosts(locale, { limit: LATEST_COUNT }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section>
        <h1 className="text-3xl font-bold">{dict.home.greeting}</h1>
        <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-400">{dict.home.intro}</p>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold">{dict.home.latest}</h2>
        <PostList locale={locale} posts={posts} emptyText={dict.posts.empty} />
        {posts.length > 0 && (
          <Link
            href={`/${locale}/posts`}
            className="mt-10 inline-block text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {dict.home.viewAll} →
          </Link>
        )}
      </section>
    </main>
  );
}
