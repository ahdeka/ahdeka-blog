import 'server-only';
import type { Locale } from '@/i18n/config';
import { createPublicClient } from '@/lib/supabase/public-server';

// 조회수 (0008_post_views.sql). 증가는 app/api/views/route.ts에서만

// 한 글의 현재 조회수 (기록이 없으면 0, 공개 글이 아니면 null)
export async function getViewCount(number: number): Promise<number | null> {
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('post_stats ( view_count )')
    .eq('number', number)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return pickViewCount((data as { post_stats: StatsEmbed }).post_stats);
}

// posts → post_stats 는 1:1이라 객체로 오지만, 버전에 따라 배열일 수도 있어 둘 다 처리
export type StatsEmbed = { view_count: number } | { view_count: number }[] | null | undefined;
export function pickViewCount(stats: StatsEmbed): number {
  const s = Array.isArray(stats) ? stats[0] : stats;
  return s?.view_count ?? 0;
}

// 인기 글 (누적 조회수 순)
export type PopularPost = { number: number; title: string; views: number };

export async function getPopularPosts(locale: Locale, limit = 5): Promise<PopularPost[]> {
  const { data, error } = await createPublicClient()
    .from('post_stats')
    .select('view_count, post:posts!inner ( number, status, post_translations!inner ( title ) )')
    .eq('post.status', 'published') // RLS와 같은 조건을 명시
    .eq('post.post_translations.locale', locale)
    .gt('view_count', 0)
    .order('view_count', { ascending: false })
    .limit(limit);
  if (error) throw error;

  type R = { view_count: number; post: { number: number; post_translations: { title: string }[] } };
  return ((data ?? []) as unknown as R[]).map((r) => ({
    number: r.post.number,
    title: r.post.post_translations[0].title,
    views: r.view_count,
  }));
}
