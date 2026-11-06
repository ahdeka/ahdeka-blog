import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import { createPublicClient } from '@/lib/supabase/public-server';

export type PublicPostSummary = {
  number: number;
  publishedAt: string;
  title: string;
  summary: string | null;
  category: { slug: string; name: string } | null;
};
export type PublicPost = PublicPostSummary & { id: string; content: string; updatedAt: string };

type Row = {
  id: string;
  number: number;
  published_at: string;
  updated_at: string;
  category: { slug: string; name_ja: string; name_ko: string } | null;
  post_translations: { title: string; summary: string | null; content?: string }[];
};

function toSummary(r: Row, locale: Locale): PublicPostSummary {
  const t = r.post_translations[0];
  return {
    number: r.number,
    publishedAt: r.published_at,
    title: t.title,
    summary: t.summary,
    category: r.category
      ? { slug: r.category.slug, name: locale === 'ja' ? r.category.name_ja : r.category.name_ko }
      : null,
  };
}

export async function getPublishedPosts(
  locale: Locale,
  options: { limit?: number } = {},
): Promise<PublicPostSummary[]> {
  let query = createPublicClient()
    .from('posts')
    .select(
      'number, published_at, updated_at, category:categories ( slug, name_ja, name_ko ), post_translations!inner ( title, summary )',
    )
    .eq('post_translations.locale', locale)
    .eq('status', 'published') // RLS와 같은 조건을 명시 → 인덱스 사용 + 의도가 코드에 드러남
    .order('published_at', { ascending: false });

  // 홈 화면처럼 최신 글 몇 개만 필요할 때
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => toSummary(r, locale));
}

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
