import { requireAdmin } from '@/lib/auth/admin';
import { flattenTree } from '@/lib/category-tree';
import CategoryManager, { type CategoryRow } from './category-manager';

type Row = {
  id: number;
  slug: string;
  name_ko: string;
  name_ja: string;
  parent_id: number | null;
  sort_order: number;
  posts: { count: number }[];
};

export default async function AdminCategoriesPage() {
  const { supabase } = await requireAdmin();

  // 관리자는 RLS "admin all"로 초안 글까지 세어짐 → 삭제 가능 여부 판단에 그대로 사용
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name_ko, name_ja, parent_id, sort_order, posts ( count )');
  if (error) return <p className="text-sm text-danger">{error.message}</p>;

  const tree = flattenTree((data ?? []) as unknown as Row[]);
  const rows: CategoryRow[] = tree.map((c) => {
    const siblings = tree.filter((s) => s.parent_id === c.parent_id);
    return {
      id: c.id,
      slug: c.slug,
      nameKo: c.name_ko,
      nameJa: c.name_ja,
      parentId: c.parent_id,
      depth: c.depth,
      postCount: c.posts?.[0]?.count ?? 0,
      childCount: tree.filter((s) => s.parent_id === c.id).length,
      isFirst: siblings[0]?.id === c.id,
      isLast: siblings.at(-1)?.id === c.id,
    };
  });

  return <CategoryManager rows={rows} />;
}
