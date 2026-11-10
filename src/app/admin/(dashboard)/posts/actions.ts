'use server';

import { getAdmin } from '@/lib/auth/admin';
import { revalidatePublic } from '@/lib/revalidate-public';
import { locales, type Locale } from '@/i18n/config';
import { describeImageDiff, diffImages, extractImages, SOURCE_LOCALE } from '@/lib/post-structure';
import { imagePathsInContent, isImagePath } from '@/lib/images/paths';
import { makeExcerpt } from '@/lib/excerpt';
import {
  MAX_TAGS_PER_POST,
  normalizeTagName,
  suggestTagSlug,
  tagNameError,
  tagSlugError,
  type TagInput,
} from '@/lib/tags';
import { claimImages, cleanupAfterSave, registerImages, removeIfUnused } from './images';
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
      // 원문에는 기준이 없음. 형식은 DB 제약(0006)과 같게
      sourceHash:
        l !== SOURCE_LOCALE && typeof t.sourceHash === 'string' && /^[0-9a-z]{1,32}$/.test(t.sourceHash) ? t.sourceHash : null,
    };
  }

  // 태그: 이름 정규화 + 대소문자만 다른 중복 제거. 형식 검사는 validate에서
  const tags: TagInput[] = [];
  for (const t of Array.isArray(r.tags) ? (r.tags as Record<string, unknown>[]).slice(0, 50) : []) {
    const name = normalizeTagName(String(t?.name ?? ''));
    if (!name || tags.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
    tags.push({ name, slug: String(t?.slug ?? '').trim().toLowerCase() || suggestTagSlug(name) });
  }

  const categoryId = Number(r.categoryId);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : undefined,
    status: r.status === 'published' ? 'published' : 'draft',
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    tags,
    coverImagePath: isImagePath(r.coverImagePath) ? r.coverImagePath : null,
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

  // 커버는 원문 본문에 있는 이미지 중에서만
  if (input.coverImagePath && !imagePathsInContent(input.translations[SOURCE_LOCALE].content).includes(input.coverImagePath)) {
    return '커버 이미지가 한국어 본문에 없습니다. 커버를 다시 고르거나 해제하세요.';
  }

  if (input.tags.length > MAX_TAGS_PER_POST) return `태그는 ${MAX_TAGS_PER_POST}개까지 달 수 있어요.`;
  for (const t of input.tags) {
    const invalid = tagNameError(t.name) ?? tagSlugError(t.slug);
    if (invalid) return `태그 「${t.name}」: ${invalid}`;
  }
  return null;
}

type Supabase = NonNullable<Awaited<ReturnType<typeof getAdmin>>>['supabase'];
type TagRow = { id: number; name: string; slug: string };

// 입력한 태그 → 태그 id (순서 유지). 없는 태그는 새로 만들 목록으로
async function resolveTags(supabase: Supabase, tags: TagInput[]) {
  if (!tags.length) return { existing: new Map<string, number>(), toCreate: [] as TagInput[], error: null };
  const { data, error } = await supabase.from('tags').select('id, name, slug');
  if (error) return { existing: new Map<string, number>(), toCreate: [], error: error.message };
  const all = (data ?? []) as TagRow[];

  const existing = new Map<string, number>(); // 소문자 이름 → id
  const toCreate: TagInput[] = [];
  for (const t of tags) {
    const found = all.find((x) => x.name.toLowerCase() === t.name.toLowerCase());
    if (found) {
      existing.set(t.name.toLowerCase(), found.id);
      continue;
    }
    // 새 태그의 주소가 다른 태그와 겹치면 저장 전에 안내 (예: Node.js와 Node-js는 둘 다 node-js)
    const clash = all.find((x) => x.slug === t.slug) ?? toCreate.find((x) => x.slug === t.slug);
    if (clash) {
      return { existing, toCreate, error: `태그 「${t.name}」의 주소 /tag/${t.slug} 는 이미 「${clash.name}」 태그가 쓰고 있어요. 주소를 바꿔 주세요.` };
    }
    toCreate.push(t);
  }
  return { existing, toCreate, error: null };
}

async function saveTags(supabase: Supabase, postId: string, tags: TagInput[], existing: Map<string, number>, toCreate: TagInput[]) {
  const ids = new Map(existing);
  if (toCreate.length) {
    const { data, error } = await supabase.from('tags').insert(toCreate).select('id, name');
    if (error) {
      return error.code === '23505' ? '같은 이름이나 주소의 태그가 방금 만들어졌어요. 다시 저장해 주세요.' : error.message;
    }
    for (const r of (data ?? []) as { id: number; name: string }[]) ids.set(r.name.toLowerCase(), r.id);
  }

  // 순서까지 바뀔 수 있으므로 통째로 교체
  const { error: delError } = await supabase.from('post_tags').delete().eq('post_id', postId);
  if (delError) return delError.message;
  if (!tags.length) return null;
  const rows = tags.map((t, position) => ({ post_id: postId, tag_id: ids.get(t.name.toLowerCase())!, position }));
  const { error } = await supabase.from('post_tags').insert(rows);
  return error?.message ?? null;
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

  const tagPlan = await resolveTags(supabase, input.tags);
  if (tagPlan.error) return { ok: false, error: tagPlan.error };

  // 이 글이 쓰는 업로드 이미지 (번역본 이미지는 원문의 일부이지만, 초안 상태를 고려해 전부 모음)
  const used = new Set(locales.flatMap((l) => imagePathsInContent(input.translations[l].content)));
  // 커버 외래키(0007)가 post_images를 가리키므로 posts보다 먼저 등록
  const regError = await registerImages(supabase, [...used]);
  if (regError) return { ok: false, error: regError.message };

  // 처음 공개한 날짜는 유지 (초안으로 돌렸다가 재공개해도 원래 날짜 그대로)
  const postFields = {
    category_id: input.categoryId,
    cover_image_path: input.coverImagePath,
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
        excerpt: makeExcerpt(t.content), // 요약이 비었을 때 대신 쓰임 (요약이 있어도 계산해 둠 → 나중에 지워도 바로 사용)
        content: t.content,
        source_hash: t.sourceHash,
      };
    });

  const { error: tError } = await supabase
    .from('post_translations').upsert(rows, { onConflict: 'post_id,locale' });
  if (tError) {
    // 새 글이면 방금 만든 posts 행을 지움 → 본문 없는 빈 글이 남지 않도록 (다음 저장 때 새로 만듦)
    if (!input.id) await supabase.from('posts').delete().eq('id', postId!);
    return { ok: false, error: tError.message };
  }

  // 본문은 저장됨. 여기부터 실패하면 글은 남기고 다시 저장하도록 안내
  const tagError = await saveTags(supabase, postId!, input.tags, tagPlan.existing, tagPlan.toCreate);
  if (tagError) {
    revalidatePublic();
    return { ok: false, error: `본문은 저장했지만 태그를 저장하지 못했습니다: ${tagError}` };
  }

  // 이미지 정리: 새로 쓴 이미지는 이 글 소속으로, 본문에서 뺀 이미지는 버킷에서 삭제
  let warning: string | undefined;
  try {
    const claimError = await claimImages(supabase, postId!, [...used]);
    if (claimError) throw claimError;
    await cleanupAfterSave(supabase, postId!, used);
  } catch (err) {
    console.error('[posts] image cleanup failed', err);
    warning = '저장했지만 안 쓰는 이미지 파일을 정리하지 못했습니다.';
  }

  revalidatePublic();
  return { ok: true, id: postId!, warning };
}

// 영구 삭제 (번역·댓글·댓글 비밀 정보·태그 연결은 DB의 on delete cascade로 함께 삭제)
// 공개를 멈추고 싶을 뿐이라면 삭제 대신 "초안"으로 저장
export async function deletePost(id: string): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Invalid id' };
  const { supabase } = admin;

  // 지우기 전에 이 글이 쓰던 이미지 경로를 모아 둠 (소속 기록 + 본문·커버)
  const [{ data: post, error: readError }, { data: owned }] = await Promise.all([
    supabase.from('posts').select('id, cover_image_path, post_translations ( content )').eq('id', id).maybeSingle(),
    supabase.from('post_images').select('path').eq('post_id', id),
  ]);
  if (readError || !post) return { ok: false, error: '글을 찾을 수 없습니다.' };

  const paths = new Set<string>((owned ?? []).map((r) => r.path as string));
  if (post.cover_image_path) paths.add(post.cover_image_path as string);
  for (const t of (post.post_translations ?? []) as { content: string }[]) {
    for (const p of imagePathsInContent(t.content)) paths.add(p);
  }

  const { data: deleted, error } = await supabase.from('posts').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!deleted?.length) return { ok: false, error: '글을 찾을 수 없습니다.' };

  // 이미지 정리: 다른 글에서도 쓰는 이미지는 남김 (복사해서 재사용했을 수 있으므로)
  // 글은 이미 삭제됐으므로 여기서 실패해도 글 삭제 자체는 성공으로 처리하고 안내만 함
  let warning: string | undefined;
  try {
    await removeIfUnused(supabase, paths);
  } catch (err) {
    console.error('[posts] image cleanup failed', err);
    warning = '글은 삭제했지만 일부 이미지 파일을 정리하지 못했습니다.';
  }

  revalidatePublic();
  return { ok: true, id, warning };
}
