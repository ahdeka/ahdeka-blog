import { requireAdmin } from '@/lib/auth/admin';
import PostEditor from '../post-editor';

export default async function NewPostPage() {
  const { supabase } = await requireAdmin();
  const { data: categories } = await supabase
    .from('categories').select('id, name_ko').order('sort_order');

  return <PostEditor categories={categories ?? []} />;
}