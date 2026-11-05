import 'server-only';
import { cache } from 'react';
import { supabasePublic } from '@/lib/supabase/public';
import type { Locale } from '@/i18n/config';

export type PostListItem = {
  slug: string;
  title: string;
  summary: string | null;
  publishedAt: string;
  category: { slug: string; name: string } | null;
};

export type PostDetail = PostListItem & {
  content: string;
  updatedAt: string;
};

// DB 응답 형태 (Supabase가 JOIN 결과를 중첩 객체로 돌려줌)
type CategoryRow = { slug: string; name_ja: string; name_ko: string } | null;
type TranslationRow = {
  title: string;
  summary: string | null;
  content?: string;
  published_at: string;
  updated_at?: string;
  posts: { slug: string; categories: CategoryRow };
};

const LIST_COLUMNS =
  'title, summary, published_at, posts!inner(slug, categories(slug, name_ja, name_ko))';
const DETAIL_COLUMNS =
  'title, summary, content, published_at, updated_at, posts!inner(slug, categories(slug, name_ja, name_ko))';

function toListItem(row: TranslationRow, locale: Locale): PostListItem {
  const c = row.posts.categories;
  return {
    slug: row.posts.slug,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at,
    category: c ? { slug: c.slug, name: locale === 'ja' ? c.name_ja : c.name_ko } : null,
  };
}

/** 언어별 공개 글 목록 (최신순) */
export async function getPublishedPosts(locale: Locale): Promise<PostListItem[]> {
  const { data, error } = await supabasePublic
    .from('post_translations')
    .select(LIST_COLUMNS)
    .eq('locale', locale)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) throw new Error(`Failed to load posts: ${error.message}`);
  return (data as unknown as TranslationRow[]).map((row) => toListItem(row, locale));
}

/** 글 상세. cache()로 감싸서 같은 요청 안에서 중복 조회를 막음 (메타데이터 + 본문) */
export const getPost = cache(
  async (locale: Locale, slug: string): Promise<PostDetail | null> => {
    const { data, error } = await supabasePublic
      .from('post_translations')
      .select(DETAIL_COLUMNS)
      .eq('locale', locale)
      .eq('status', 'published')
      .eq('posts.slug', slug)
      .maybeSingle();

    if (error) throw new Error(`Failed to load post: ${error.message}`);
    if (!data) return null;

    const row = data as unknown as TranslationRow;
    return {
      ...toListItem(row, locale),
      content: row.content ?? '',
      updatedAt: row.updated_at ?? row.published_at,
    };
  },
);

/** 이 글이 공개된 언어 목록 (hreflang 생성용) */
export const getPublishedLocales = cache(async (slug: string): Promise<Locale[]> => {
  const { data, error } = await supabasePublic
    .from('post_translations')
    .select('locale, posts!inner(slug)')
    .eq('status', 'published')
    .eq('posts.slug', slug);

  if (error) throw new Error(`Failed to load locales: ${error.message}`);
  return (data ?? []).map((row) => row.locale as Locale);
});

/** 빌드 시 미리 생성할 (언어, slug) 목록 */
export async function getAllPublishedSlugs(): Promise<{ locale: Locale; slug: string }[]> {
  const { data, error } = await supabasePublic
    .from('post_translations')
    .select('locale, posts!inner(slug)')
    .eq('status', 'published');

  if (error) throw new Error(`Failed to load slugs: ${error.message}`);
  return (data as unknown as { locale: Locale; posts: { slug: string } }[]).map((row) => ({
    locale: row.locale,
    slug: row.posts.slug,
  }));
}