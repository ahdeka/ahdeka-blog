import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getPublishedPosts } from '@/lib/posts';
import PostList from '@/components/post-list';

// 글 저장 시 revalidatePath로 즉시 갱신. 이 값은 혹시 모를 경우를 위한 안전망(하루)
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = await getDictionary(locale);
  return {
    title: dict.posts.title,
    alternates: {
      canonical: `/${locale}/posts`,
      languages: { ja: '/ja/posts', ko: '/ko/posts', 'x-default': '/ja/posts' },
    },
  };
}

export default async function PostListPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, posts] = await Promise.all([getDictionary(locale), getPublishedPosts(locale)]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{dict.posts.title}</h1>
      <PostList locale={locale} posts={posts} emptyText={dict.posts.empty} />
    </main>
  );
}
