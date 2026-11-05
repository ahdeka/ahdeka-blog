'use server';

import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/auth/admin';
import { locales, type Locale } from '@/i18n/config';
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
  return null;
}

function revalidatePublic() {
  // /ja, /ko 아래 모든 공개 페이지 캐시 갱신
  revalidatePath('/[locale]', 'layout');
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

// 소프트 삭제 / 복원
export async function setPostDeleted(id: string, deleted: boolean): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Invalid id' };

  const { data, error } = await admin.supabase
    .from('posts')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: '글을 찾을 수 없습니다.' };

  revalidatePublic();
  return { ok: true, id };
}