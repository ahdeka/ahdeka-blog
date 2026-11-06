'use server';

import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/auth/admin';
import { revalidatePublic } from '@/lib/revalidate-public';

export type CategoryInput = { slug: string; nameKo: string; nameJa: string; parentId: number | null };
type Result = { ok: true } | { ok: false; error: string };
type Supabase = NonNullable<Awaited<ReturnType<typeof getAdmin>>>['supabase'];

// DB 제약과 같은 규칙 (0001: slug 형식, 0005: 이름 1~50자 · 2단계까지)
const SLUG_RE = /^[a-z0-9-]+$/;
const SLUG_MAX = 50;
const NAME_MAX = 50;

const validId = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0;

// Server Action은 공개 엔드포인트 → 인자를 믿지 않고 정규화·검사
function normalize(raw: unknown): CategoryInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const slug = String(r.slug ?? '').trim().toLowerCase();
  const nameKo = String(r.nameKo ?? '').trim();
  const nameJa = String(r.nameJa ?? '').trim();
  const parentId = r.parentId == null ? null : Number(r.parentId);
  if (!SLUG_RE.test(slug) || slug.length > SLUG_MAX) return `주소(slug)는 영어 소문자·숫자·하이픈으로 ${SLUG_MAX}자 이내여야 합니다.`;
  if (!nameKo || nameKo.length > NAME_MAX) return `한국어 이름은 1~${NAME_MAX}자로 입력하세요.`;
  if (!nameJa || nameJa.length > NAME_MAX) return `일본어 이름은 1~${NAME_MAX}자로 입력하세요.`;
  if (parentId !== null && !validId(parentId)) return '상위 카테고리가 올바르지 않습니다.';
  return { slug, nameKo, nameJa, parentId };
}

function dbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return '같은 주소(slug)의 카테고리가 이미 있습니다.';
  if (error.code === '23503') return '글이나 하위 카테고리가 남아 있어 삭제할 수 없습니다.';
  if (error.code === '23514') return '카테고리는 2단계(상위/하위)까지만 만들 수 있습니다.';
  return error.message;
}

// 상위로 지정할 수 있는지 (최종 판정은 DB 트리거, 여기는 친절한 안내용)
async function checkParent(supabase: Supabase, parentId: number | null, selfId?: number): Promise<string | null> {
  if (parentId === null) return null;
  if (parentId === selfId) return '자기 자신을 상위 카테고리로 지정할 수 없습니다.';
  const { data: parent } = await supabase.from('categories').select('parent_id').eq('id', parentId).maybeSingle();
  if (!parent) return '상위 카테고리를 찾을 수 없습니다.';
  if (parent.parent_id !== null) return '하위 카테고리 아래에는 카테고리를 만들 수 없습니다 (2단계까지).';
  if (selfId) {
    const { count } = await supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', selfId);
    if (count) return '하위 카테고리가 있는 카테고리는 다른 카테고리 아래로 옮길 수 없습니다.';
  }
  return null;
}

// 같은 상위 안에서 맨 뒤 순서
async function nextSortOrder(supabase: Supabase, parentId: number | null) {
  let q = supabase.from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  q = parentId === null ? q.is('parent_id', null) : q.eq('parent_id', parentId);
  const { data } = await q.maybeSingle();
  return ((data?.sort_order as number | undefined) ?? -1) + 1;
}

function revalidateAll() {
  revalidatePublic();
  revalidatePath('/admin', 'layout'); // 에디터의 카테고리 선택지 등
}

export async function createCategory(raw: CategoryInput): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  const input = normalize(raw);
  if (typeof input === 'string') return { ok: false, error: input };
  const { supabase } = admin;

  const invalid = await checkParent(supabase, input.parentId);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from('categories').insert({
    slug: input.slug,
    name_ko: input.nameKo,
    name_ja: input.nameJa,
    parent_id: input.parentId,
    sort_order: await nextSortOrder(supabase, input.parentId),
  });
  if (error) return { ok: false, error: dbError(error) };

  revalidateAll();
  return { ok: true };
}

export async function updateCategory(id: number, raw: CategoryInput): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (!validId(id)) return { ok: false, error: 'Invalid id' };
  const input = normalize(raw);
  if (typeof input === 'string') return { ok: false, error: input };
  const { supabase } = admin;

  const { data: prev } = await supabase.from('categories').select('parent_id').eq('id', id).maybeSingle();
  if (!prev) return { ok: false, error: '카테고리를 찾을 수 없습니다.' };

  const moved = prev.parent_id !== input.parentId;
  if (moved) {
    const invalid = await checkParent(supabase, input.parentId, id);
    if (invalid) return { ok: false, error: invalid };
  }

  const { error } = await supabase
    .from('categories')
    .update({
      slug: input.slug,
      name_ko: input.nameKo,
      name_ja: input.nameJa,
      parent_id: input.parentId,
      // 다른 상위로 옮기면 그 안에서 맨 뒤로
      ...(moved ? { sort_order: await nextSortOrder(supabase, input.parentId) } : {}),
    })
    .eq('id', id);
  if (error) return { ok: false, error: dbError(error) };

  revalidateAll();
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (!validId(id)) return { ok: false, error: 'Invalid id' };
  const { supabase } = admin;

  // 친절한 안내용 사전 검사 (최종 방어선은 DB의 on delete restrict)
  const [{ count: posts }, { count: children }] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('category_id', id),
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', id),
  ]);
  if (children) return { ok: false, error: `하위 카테고리가 ${children}개 있습니다. 하위 카테고리를 먼저 옮기거나 삭제하세요.` };
  if (posts) return { ok: false, error: `이 카테고리에 글이 ${posts}개 남아 있습니다. 글의 카테고리를 먼저 바꾸세요.` };

  const { data, error } = await supabase.from('categories').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: '카테고리를 찾을 수 없습니다.' };

  revalidateAll();
  return { ok: true };
}

// 같은 상위 안에서 한 칸 위/아래로. 순서 값이 겹쳐 있을 수 있으므로 형제 전체를 0,1,2…로 다시 매김
export async function moveCategory(id: number, direction: 'up' | 'down'): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (!validId(id) || (direction !== 'up' && direction !== 'down')) return { ok: false, error: 'Invalid input' };
  const { supabase } = admin;

  const { data: self } = await supabase.from('categories').select('parent_id').eq('id', id).maybeSingle();
  if (!self) return { ok: false, error: '카테고리를 찾을 수 없습니다.' };

  let q = supabase.from('categories').select('id, sort_order').order('sort_order').order('id');
  q = self.parent_id === null ? q.is('parent_id', null) : q.eq('parent_id', self.parent_id);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as { id: number; sort_order: number }[];

  const i = rows.findIndex((r) => r.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];

  const changed = rows.map((r, order) => ({ ...r, order })).filter((r) => r.sort_order !== r.order);
  const results = await Promise.all(
    changed.map((r) => supabase.from('categories').update({ sort_order: r.order }).eq('id', r.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidateAll();
  return { ok: true };
}
