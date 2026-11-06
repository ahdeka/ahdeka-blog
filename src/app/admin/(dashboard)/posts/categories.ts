import 'server-only';
import { flattenTree } from '@/lib/category-tree';
import type { getAdmin } from '@/lib/auth/admin';

type Supabase = NonNullable<Awaited<ReturnType<typeof getAdmin>>>['supabase'];
export type EditorCategory = { id: number; name_ko: string; depth: 0 | 1 };

// 에디터 카테고리 선택지: 상위 → 하위 순으로 펼침
export async function getEditorCategories(supabase: Supabase): Promise<EditorCategory[]> {
  const { data } = await supabase.from('categories').select('id, name_ko, parent_id, sort_order');
  type R = { id: number; name_ko: string; parent_id: number | null; sort_order: number };
  return flattenTree((data ?? []) as R[]).map(({ id, name_ko, depth }) => ({ id, name_ko, depth }));
}
