import { requireAdmin } from '@/lib/auth/admin';
import PostEditor from '../post-editor';
import { getEditorCategories } from '../categories';
import { getEditorTags } from '../tag-options';

export default async function NewPostPage() {
  const { supabase } = await requireAdmin();
  const [categories, tagOptions] = await Promise.all([getEditorCategories(supabase), getEditorTags(supabase)]);

  return <PostEditor categories={categories} tagOptions={tagOptions} />;
}
