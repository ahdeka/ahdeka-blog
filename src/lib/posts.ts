import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import { createPublicClient } from '@/lib/supabase/public-server';

export type PublicCategory = { slug: string; name: string };

export type PublicPostSummary = {
  number: number;
  publishedAt: string;
  title: string;
  summary: string | null;
  category: PublicCategory | null;
  commentCount: number;
};
export type PublicPost = PublicPostSummary & { id: string; content: string; updatedAt: string };

type CategoryRow = { slug: string; name_ja: string; name_ko: string };
type Row = {
  id: string;
  number: number;
  published_at: string;
  updated_at: string;
  category: CategoryRow | null;
  post_translations: { title: string; summary: string | null; content?: string }[];
  comments?: { count: number }[];
};

const categoryName = (c: CategoryRow, locale: Locale) => (locale === 'ja' ? c.name_ja : c.name_ko);

function toSummary(r: Row, locale: Locale): PublicPostSummary {
  const t = r.post_translations[0];
  return {
    number: r.number,
    publishedAt: r.published_at,
    title: t.title,
    summary: t.summary,
    category: r.category ? { slug: r.category.slug, name: categoryName(r.category, locale) } : null,
    commentCount: r.comments?.[0]?.count ?? 0,
  };
}

// 목록용. categorySlug가 있으면 그 카테고리 글만
export async function getPublishedPosts(
  locale: Locale,
  options: { categorySlug?: string } = {},
): Promise<PublicPostSummary[]> {
  // 카테고리로 거를 때만 !inner (카테고리 없는 글이 빠지도록)
  const categoryJoin = options.categorySlug ? 'categories!inner' : 'categories';
  let query = createPublicClient()
    .from('posts')
    .select(
      `number, published_at, updated_at, category:${categoryJoin} ( slug, name_ja, name_ko ), post_translations!inner ( title, summary ), comments ( count )`,
    )
    .eq('post_translations.locale', locale)
    .eq('status', 'published') // RLS와 같은 조건을 명시 → 인덱스 사용 + 의도가 코드에 드러남
    .is('comments.deleted_at', null) // 삭제 표시(묘비)만 남은 댓글은 개수에서 제외
    .order('published_at', { ascending: false });

  if (options.categorySlug) query = query.eq('category.slug', options.categorySlug);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => toSummary(r, locale));
}

// 사이드바 카테고리 목록 + 공개 글 수 (RLS로 공개 글만 세어짐)
export type CategoryWithCount = PublicCategory & { count: number };

export const getCategories = cache(async (locale: Locale): Promise<CategoryWithCount[]> => {
  const { data, error } = await createPublicClient()
    .from('categories')
    .select('slug, name_ja, name_ko, posts ( count )')
    .eq('posts.status', 'published')
    .order('sort_order');
  if (error) throw error;
  type R = CategoryRow & { posts: { count: number }[] };
  return ((data ?? []) as unknown as R[]).map((c) => ({
    slug: c.slug,
    name: categoryName(c, locale),
    count: c.posts?.[0]?.count ?? 0,
  }));
});

// generateMetadata와 page에서 두 번 불러도 DB 조회는 1번만 (cache)
export const getPublishedPost = cache(
  async (number: number, locale: Locale): Promise<PublicPost | null> => {
    const { data, error } = await createPublicClient()
      .from('posts')
      .select(
        'id, number, published_at, updated_at, category:categories ( slug, name_ja, name_ko ), post_translations!inner ( title, summary, content )',
      )
      .eq('number', number)
      .eq('post_translations.locale', locale)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const r = data as unknown as Row;
    return { ...toSummary(r, locale), id: r.id, updatedAt: r.updated_at, content: r.post_translations[0].content ?? '' };
  },
);

// 이전 글(더 오래된 글)·다음 글(더 최근 글)
export type AdjacentPost = { number: number; title: string } | null;

export async function getAdjacentPosts(
  publishedAt: string,
  locale: Locale,
): Promise<{ prev: AdjacentPost; next: AdjacentPost }> {
  const base = () =>
    createPublicClient()
      .from('posts')
      .select('number, post_translations!inner ( title )')
      .eq('post_translations.locale', locale)
      .eq('status', 'published')
      .limit(1);

  const [older, newer] = await Promise.all([
    base().lt('published_at', publishedAt).order('published_at', { ascending: false }).maybeSingle(),
    base().gt('published_at', publishedAt).order('published_at', { ascending: true }).maybeSingle(),
  ]);
  if (older.error) throw older.error;
  if (newer.error) throw newer.error;

  type R = { number: number; post_translations: { title: string }[] } | null;
  const pick = (r: R): AdjacentPost => (r ? { number: r.number, title: r.post_translations[0].title } : null);
  return { prev: pick(older.data as R), next: pick(newer.data as R) };
}

// sitemap용: 공개된 글의 번호와 최종 수정일만 (본문은 가져오지 않음 → 전송량 절약)
export async function getPublishedPostRefs(): Promise<{ number: number; updatedAt: string }[]> {
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('number, updated_at')
    .eq('status', 'published')
    .order('number', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({ number: r.number as number, updatedAt: r.updated_at as string }));
}

// 공개 글 수 (카테고리 화면의 "전체글" 숫자용, 행은 가져오지 않음)
export async function countPublishedPosts(): Promise<number> {
  const { count, error } = await createPublicClient()
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  if (error) throw error;
  return count ?? 0;
}
