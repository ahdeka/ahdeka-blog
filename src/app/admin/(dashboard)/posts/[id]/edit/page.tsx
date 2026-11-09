import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { locales, type Locale } from '@/i18n/config';
import type { TagInput } from '@/lib/tags';
import PostEditor from '../../post-editor';
import { getEditorCategories } from '../../categories';
import { getEditorTags } from '../../tag-options';
import type { PostStatus, TranslationInput } from '../../types';

type Props = { params: Promise<{ id: string }> };

type Row = {
  id: string;
  number: number;
  status: PostStatus;
  published_at: string | null;
  category_id: number | null;
  cover_image_path: string | null;
  post_translations: { locale: string; title: string; summary: string | null; content: string; source_hash: string | null }[];
  post_tags: { position: number; tag: TagInput | null }[];
};

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data, error }, categories, tagOptions] = await Promise.all([
    supabase
      .from('posts')
      .select(
        'id, number, status, published_at, category_id, cover_image_path, post_translations ( locale, title, summary, content, source_hash ), post_tags ( position, tag:tags ( name, slug ) )',
      )
      .eq('id', id)
      .maybeSingle(),
    getEditorCategories(supabase),
    getEditorTags(supabase),
  ]);

  // 잘못된 UUID 형식도 error로 들어오므로 함께 404 처리
  if (error || !data) notFound();
  const post = data as unknown as Row;

  const translations = Object.fromEntries(
    locales.map((l) => {
      const t = post.post_translations.find((x) => x.locale === l);
      const value: TranslationInput = t
        ? { title: t.title, summary: t.summary ?? '', content: t.content, sourceHash: t.source_hash }
        : { title: '', summary: '', content: '', sourceHash: null };
      return [l, value];
    }),
  ) as Record<Locale, TranslationInput>;

  const tags = [...(post.post_tags ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((r) => (r.tag ? [{ name: r.tag.name, slug: r.tag.slug }] : []));

  return (
    <PostEditor
      key={post.id}
      categories={categories}
      tagOptions={tagOptions}
      initial={{
        id: post.id,
        number: post.number,
        publishedAt: post.published_at,
        status: post.status,
        categoryId: post.category_id,
        tags,
        coverImagePath: post.cover_image_path,
        translations,
      }}
    />
  );
}
