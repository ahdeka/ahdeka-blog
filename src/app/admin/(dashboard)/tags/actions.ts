'use server';

import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/auth/admin';
import { revalidatePublic } from '@/lib/revalidate-public';
import { normalizeTagName, tagNameError, tagSlugError } from '@/lib/tags';

type Result = { ok: true } | { ok: false; error: string };

const validId = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0;

function revalidateAll() {
  revalidatePublic();
  revalidatePath('/admin', 'layout'); // 에디터 자동완성
}

// 태그는 글을 쓰면서 만들고, 여기서는 이름·주소 수정과 삭제만
export async function updateTag(id: number, raw: { name: string; slug: string }): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (!validId(id)) return { ok: false, error: 'Invalid id' };

  const name = normalizeTagName(String(raw?.name ?? ''));
  const slug = String(raw?.slug ?? '').trim().toLowerCase();
  const invalid = tagNameError(name) ?? tagSlugError(slug);
  if (invalid) return { ok: false, error: invalid };

  const { data, error } = await admin.supabase.from('tags').update({ name, slug }).eq('id', id).select('id');
  if (error) {
    return { ok: false, error: error.code === '23505' ? '같은 이름(대소문자 무시)이나 주소의 태그가 이미 있습니다.' : error.message };
  }
  if (!data?.length) return { ok: false, error: '태그를 찾을 수 없습니다.' };

  revalidateAll();
  return { ok: true };
}

// 글에 붙어 있어도 삭제 가능 (글에서 그 태그만 빠짐 · post_tags on delete cascade)
export async function deleteTag(id: number): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (!validId(id)) return { ok: false, error: 'Invalid id' };

  const { data, error } = await admin.supabase.from('tags').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: '태그를 찾을 수 없습니다.' };

  revalidateAll();
  return { ok: true };
}
