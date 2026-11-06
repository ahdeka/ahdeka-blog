import { requireAdmin } from '@/lib/auth/admin';
import PostEditor from '../post-editor';
import { getEditorCategories } from '../categories';

export default async function NewPostPage() {
  const { supabase } = await requireAdmin();
  const categories = await getEditorCategories(supabase);

  return <PostEditor categories={categories} />;
}
