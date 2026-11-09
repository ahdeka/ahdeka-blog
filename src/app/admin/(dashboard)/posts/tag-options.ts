import 'server-only';
import type { getAdmin } from '@/lib/auth/admin';
import type { TagInput } from '@/lib/tags';

type Supabase = NonNullable<Awaited<ReturnType<typeof getAdmin>>>['supabase'];

// 에디터 자동완성: 기존 태그 전체 (이름순)
export async function getEditorTags(supabase: Supabase): Promise<TagInput[]> {
  const { data } = await supabase.from('tags').select('name, slug').order('name');
  return (data ?? []) as TagInput[];
}
