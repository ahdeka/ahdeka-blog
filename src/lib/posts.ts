import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import { createPublicClient } from '@/lib/supabase/public-server';
import { flattenTree } from '@/lib/category-tree';
import { imageSizeFromUrl } from '@/lib/images/dimensions';
import { imageUrl } from '@/lib/images/paths';
import { pickViewCount, type StatsEmbed } from '@/lib/views';

export type CategoryRef = { slug: string; name: string };
// parent: 하위 카테고리일 때 그 상위 (목록·이동 경로에 "개발 › Java"처럼 표시)
export type PublicCategory = CategoryRef & { parent: CategoryRef | null };

// 태그 이름은 언어 공통 (영문 하나)
export type TagRef = { slug: string; name: string };
export type CoverImage = { url: string; width: number; height: number };

export type PublicPostSummary = {
  number: number;
  publishedAt: string;
  title: string;
  summary: string | null; // 직접 쓴 요약, 없으면 본문 발췌
  category: PublicCategory | null;
  tags: TagRef[];
  cover: CoverImage | null;
  commentCount: number;
  viewCount: number;
};
export type PublicPost = PublicPostSummary & { id: string; content: string; updatedAt: string };

type CategoryRow = { slug: string; name_ja: string; name_ko: string };
type PostCategoryRow = CategoryRow & { parent: CategoryRow | null };

// 글에 붙은 카테고리 + 상위 카테고리 (parent_id 외래키로 자기 자신을 조인)
const CATEGORY_FIELDS = 'slug, name_ja, name_ko, parent:parent_id ( slug, name_ja, name_ko )';
// 태그 (에디터에서 넣은 순서) + 커버 이미지 경로
const EXTRA_FIELDS = 'cover_image_path, post_tags ( position, tag:tags ( slug, name ) )';

type Row = {
  id: string;
  number: number;
  published_at: string;
  updated_at: string;
  cover_image_path: string | null;
  category: PostCategoryRow | null;
  post_tags: { position: number; tag: TagRef | null }[];
  post_translations: { title: string; summary: string | null; excerpt: string | null; content?: string }[];
  comments?: { count: number }[];
  post_stats?: StatsEmbed;
};

const categoryName = (c: CategoryRow, locale: Locale) => (locale === 'ja' ? c.name_ja : c.name_ko);

// 크기는 파일명에 들어 있음 ({uuid}_{가로}x{세로}.webp)
function toCover(path: string | null): CoverImage | null {
  if (!path) return null;
  const url = imageUrl(path);
  const size = imageSizeFromUrl(url);
  return size ? { url, ...size } : null;
}

function toSummary(r: Row, locale: Locale): PublicPostSummary {
  const t = r.post_translations[0];
  return {
    number: r.number,
    publishedAt: r.published_at,
    title: t.title,
    // 요약을 비워 둔 글은 본문 발췌로 (목록·OG·RSS 모두 이 값을 씀)
    summary: t.summary ?? t.excerpt,
    category: r.category
      ? {
          slug: r.category.slug,
          name: categoryName(r.category, locale),
          parent: r.category.parent ? { slug: r.category.parent.slug, name: categoryName(r.category.parent, locale) } : null,
        }
      : null,
    tags: [...(r.post_tags ?? [])]
      .sort((a, b) => a.position - b.position)
      .flatMap((pt) => (pt.tag ? [{ slug: pt.tag.slug, name: pt.tag.name }] : [])),
    cover: toCover(r.cover_image_path),
    commentCount: r.comments?.[0]?.count ?? 0,
    viewCount: pickViewCount(r.post_stats),
  };
}

// 목록용
// - categorySlugs: 그 카테고리들의 글만 (상위 카테고리 = 자신 + 하위들)
// - postIds: 그 글들만 (태그 화면)
export async function getPublishedPosts(
  locale: Locale,
  options: { categorySlugs?: string[]; postIds?: string[] } = {},
): Promise<PublicPostSummary[]> {
  if (options.postIds && options.postIds.length === 0) return [];
  // 카테고리로 거를 때만 !inner (카테고리 없는 글이 빠지도록)
  const categoryJoin = options.categorySlugs ? 'categories!inner' : 'categories';
  let query = createPublicClient()
    .from('posts')
    .select(
      `number, published_at, updated_at, ${EXTRA_FIELDS}, category:${categoryJoin} ( ${CATEGORY_FIELDS} ), post_translations!inner ( title, summary, excerpt ), comments ( count ), post_stats ( view_count )`,
    )
    .eq('post_translations.locale', locale)
    .eq('status', 'published') // RLS와 같은 조건을 명시 → 인덱스 사용 + 의도가 코드에 드러남
    .is('comments.deleted_at', null) // 삭제 표시(묘비)만 남은 댓글은 개수에서 제외
    .order('published_at', { ascending: false });

  if (options.categorySlugs) query = query.in('category.slug', options.categorySlugs);
  if (options.postIds) query = query.in('id', options.postIds);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => toSummary(r, locale));
}

// 사이드바 카테고리 목록 + 공개 글 수 (RLS로 공개 글만 세어짐)
// 상위 → 하위 순으로 펼친 목록. total은 상위라면 하위 글까지 합친 수
export type CategoryWithCount = CategoryRef & {
  depth: 0 | 1;
  childSlugs: string[];
  count: number; // 이 카테고리에 직접 속한 글
  total: number; // count + 하위 카테고리 글
};

export const getCategories = cache(async (locale: Locale): Promise<CategoryWithCount[]> => {
  const { data, error } = await createPublicClient()
    .from('categories')
    .select('id, slug, name_ja, name_ko, parent_id, sort_order, posts ( count )')
    .eq('posts.status', 'published');
  if (error) throw error;
  type R = CategoryRow & { id: number; parent_id: number | null; sort_order: number; posts: { count: number }[] };
  const tree = flattenTree((data ?? []) as unknown as R[]);
  const own = (c: R) => c.posts?.[0]?.count ?? 0;
  return tree.map((c) => {
    const children = tree.filter((x) => x.parent_id === c.id);
    return {
      slug: c.slug,
      name: categoryName(c, locale),
      depth: c.depth,
      childSlugs: children.map((x) => x.slug),
      count: own(c),
      total: own(c) + children.reduce((n, x) => n + own(x), 0),
    };
  });
});

// generateMetadata와 page에서 두 번 불러도 DB 조회는 1번만 (cache)
export const getPublishedPost = cache(
  async (number: number, locale: Locale): Promise<PublicPost | null> => {
    const { data, error } = await createPublicClient()
      .from('posts')
      .select(
        `id, number, published_at, updated_at, ${EXTRA_FIELDS}, category:categories ( ${CATEGORY_FIELDS} ), post_translations!inner ( title, summary, excerpt, content ), post_stats ( view_count )`,
      )
      .eq('number', number)
      .eq('post_translations.locale', locale)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const r = data as unknown as Row;
    return {
      ...toSummary(r, locale),
      id: r.id,
      updatedAt: r.updated_at,
      content: r.post_translations[0].content ?? '',
    };
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

// 태그 화면: 태그 + 그 태그가 붙은 공개 글 id
// post_tags는 RLS로 공개 글의 연결만 보이므로, 공개 글이 하나도 없으면 postIds가 빈 배열
// generateMetadata와 page에서 함께 쓰므로 cache
export const getTagWithPostIds = cache(
  async (slug: string): Promise<{ tag: TagRef; postIds: string[] } | null> => {
    const { data, error } = await createPublicClient()
      .from('tags')
      .select('slug, name, post_tags ( post_id )')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as unknown as TagRef & { post_tags: { post_id: string }[] };
    return { tag: { slug: r.slug, name: r.name }, postIds: (r.post_tags ?? []).map((pt) => pt.post_id) };
  },
);

// sitemap용: 공개 글이 하나 이상 붙은 태그
export async function getPublishedTagSlugs(): Promise<string[]> {
  const { data, error } = await createPublicClient().from('tags').select('slug, post_tags!inner ( post_id )');
  if (error) throw error;
  return (data ?? []).map((r) => r.slug as string);
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

// 홈 오른쪽 "태그": 공개 글이 많이 붙은 순 (post_tags의 RLS가 공개 글의 행만 돌려주므로 count = 공개 글 수)
export async function getPopularTags(limit = 8): Promise<TagRef[]> {
  const { data, error } = await createPublicClient().from('tags').select('slug, name, post_tags ( count )');
  if (error) throw error;
  type R = TagRef & { post_tags: { count: number }[] };
  return ((data ?? []) as unknown as R[])
    .map((t) => ({ slug: t.slug, name: t.name, count: t.post_tags?.[0]?.count ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ slug, name }) => ({ slug, name }));
}
