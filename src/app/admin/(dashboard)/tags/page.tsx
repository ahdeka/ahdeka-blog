import { requireAdmin } from '@/lib/auth/admin';
import TagManager, { type TagRow } from './tag-manager';

type Row = { id: number; name: string; slug: string; post_tags: { count: number }[] };

export default async function AdminTagsPage() {
  const { supabase } = await requireAdmin();

  // 관리자는 RLS "admin all"로 초안 글까지 세어짐
  const { data, error } = await supabase.from('tags').select('id, name, slug, post_tags ( count )').order('name');
  if (error) return <p className="text-sm text-danger">{error.message}</p>;

  const rows: TagRow[] = ((data ?? []) as unknown as Row[]).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    postCount: t.post_tags?.[0]?.count ?? 0,
  }));

  return <TagManager rows={rows} />;
}
