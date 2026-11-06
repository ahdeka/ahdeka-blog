'use server';

import { getAdmin } from '@/lib/auth/admin';
import { revalidatePublic } from '@/lib/revalidate-public';
import { locales, type Locale } from '@/i18n/config';
import { describeImageDiff, diffImages, extractImages, SOURCE_LOCALE } from '@/lib/post-structure';
import type { ActionResult, PostInput, TranslationInput } from './types';

const MAX_CONTENT = 200_000;

// Server Action은 누구나 POST할 수 있는 공개 엔드포인트 → 인자의 타입을 믿지 않고 정규화
function normalize(raw: unknown): PostInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const tr = (r.translations ?? {}) as Record<string, Record<string, unknown> | undefined>;

  const translations = {} as Record<Locale, TranslationInput>;
  for (const l of locales) {
    const t = tr[l] ?? {};
    translations[l] = {
      title: String(t.title ?? ''),
      summary: String(t.summary ?? ''),
      content: String(t.content ?? ''),
    };
  }

  const categoryId = Number(r.categoryId);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : undefined,
    status: r.status === 'published' ? 'published' : 'draft',
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    translations,
  };
}

function validate(input: PostInput): string | null {
  if (!locales.some((l) => input.translations[l].title.trim())) {
    return '최소 한 언어는 제목이 필요합니다.';
  }
  for (const l of locales) {
    const t = input.translations[l];
    const tag = l.toUpperCase();
    if (t.title.length > 200) return `${tag}: 제목은 200자 이내로 입력하세요.`;
    if (t.summary.length > 500) return `${tag}: 요약은 500자 이내로 입력하세요.`;
    if (t.content.length > MAX_CONTENT) return `${tag}: 본문이 너무 깁니다.`;
    // 공개하려면 양 언어 모두 필요 (언어에 상관없이 같은 글이 보이도록)
    if (input.status === 'published' && (!t.title.trim() || !t.content.trim())) {
      return `공개하려면 ${tag} 제목과 본문이 모두 필요합니다.`;
    }
  }

  // 번역본 이미지 = 원문(KO) 이미지 (같은 이미지, 같은 순서)
  // 초안은 번역 작업 중일 수 있으므로 누락만은 허용하고, 원문에 없는 이미지는 언제나 거부
  const sourceImages = extractImages(input.translations[SOURCE_LOCALE].content);
  for (const l of locales) {
    if (l === SOURCE_LOCALE) continue;
    const content = input.translations[l].content;
    if (!content.trim()) continue;
    const diff = diffImages(sourceImages, extractImages(content));
    if (!diff) continue;
    if (input.status === 'published' || diff.extra.length) {
      return `${l.toUpperCase()}: ${describeImageDiff(diff)} — 이미지는 원문(KO)과 같아야 합니다.`;
    }
  }
  return null;
}

export async function savePost(raw: PostInput): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };

  const input = normalize(raw);
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const { supabase } = admin;
  let postId = input.id;
  let prevPublishedAt: string | null = null;

  if (postId) {
    const { data: prev, error } = await supabase
      .from('posts').select('published_at').eq('id', postId).maybeSingle();
    if (error || !prev) return { ok: false, error: '글을 찾을 수 없습니다.' };
    prevPublishedAt = prev.published_at as string | null;
  }

  // 처음 공개한 날짜는 유지 (초안으로 돌렸다가 재공개해도 원래 날짜 그대로)
  const postFields = {
    category_id: input.categoryId,
    status: input.status,
    published_at:
      input.status === 'published' ? (prevPublishedAt ?? new Date().toISOString()) : prevPublishedAt,
  };

  if (postId) {
    const { error } = await supabase.from('posts').update(postFields).eq('id', postId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase.from('posts').insert(postFields).select('id').single();
    if (error) return { ok: false, error: error.message };
    postId = data.id as string;
  }

  // 제목이 빈 언어는 "아직 작성 안 함"으로 보고 저장하지 않음 (초안일 때만 가능)
  const rows = locales
    .filter((l) => input.translations[l].title.trim())
    .map((l) => {
      const t = input.translations[l];
      return {
        post_id: postId,
        locale: l,
        title: t.title.trim(),
        summary: t.summary.trim() || null,
        content: t.content,
      };
    });

  const { error: tError } = await supabase
    .from('post_translations').upsert(rows, { onConflict: 'post_id,locale' });
  if (tError) return { ok: false, error: tError.message };

  revalidatePublic();
  return { ok: true, id: postId! };
}

// 본문 Markdown에 들어 있는 업로드 이미지 경로 추출 (upload-post-image.ts가 만드는 형식만)
const IMAGE_PATH =
  /\/storage\/v1\/object\/public\/post-images\/(\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+x\d+\.webp)/g;

// LIKE 검색에서 _ 와 % 는 와일드카드이므로 이스케이프
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

// 영구 삭제 (번역·댓글·댓글 비밀 정보는 DB의 on delete cascade로 함께 삭제)
// 공개를 멈추고 싶을 뿐이라면 삭제 대신 "초안"으로 저장
export async function deletePost(id: string): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Invalid id' };
  const { supabase } = admin;

  // 지우기 전에 이 글이 쓰던 이미지 경로를 모아 둠
  const { data: post, error: readError } = await supabase
    .from('posts')
    .select('id, cover_image_path, post_translations ( content )')
    .eq('id', id)
    .maybeSingle();
  if (readError || !post) return { ok: false, error: '글을 찾을 수 없습니다.' };

  const paths = new Set<string>();
  if (post.cover_image_path) paths.add(post.cover_image_path as string);
  for (const t of (post.post_translations ?? []) as { content: string }[]) {
    for (const m of t.content.matchAll(IMAGE_PATH)) paths.add(m[1]);
  }

  const { data: deleted, error } = await supabase.from('posts').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!deleted?.length) return { ok: false, error: '글을 찾을 수 없습니다.' };

  // 이미지 정리: 다른 글에서도 쓰는 이미지는 남김 (복사해서 재사용했을 수 있으므로)
  // 글은 이미 삭제됐으므로 여기서 실패해도 글 삭제 자체는 성공으로 처리하고 안내만 함
  let warning: string | undefined;
  try {
    const orphans: string[] = [];
    for (const path of paths) {
      const [{ count: inContent }, { count: asCover }] = await Promise.all([
        supabase.from('post_translations').select('id', { count: 'exact', head: true }).ilike('content', `%${escapeLike(path)}%`),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('cover_image_path', path),
      ]);
      if (!inContent && !asCover) orphans.push(path);
    }
    if (orphans.length) {
      const { error: rmError } = await supabase.storage.from('post-images').remove(orphans);
      if (rmError) throw rmError;
    }
  } catch (err) {
    console.error('[posts] image cleanup failed', err);
    warning = '글은 삭제했지만 일부 이미지 파일을 정리하지 못했습니다.';
  }

  revalidatePublic();
  return { ok: true, id, warning };
}
