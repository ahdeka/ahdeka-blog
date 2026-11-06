import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { locales, type Locale } from '@/i18n/config';
import PostEditor from '../../post-editor';
import type { PostStatus, TranslationInput } from '../../types';

type Props = { params: Promise<{ id: string }> };

type Row = {
  id: string;
  number: number;
  status: PostStatus;
  published_at: string | null;
  category_id: number | null;
  post_translations: { locale: string; title: string; summary: string | null; content: string }[];
};

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data, error }, { data: categories }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, number, status, published_at, category_id, post_translations ( locale, title, summary, content )')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('categories').select('id, name_ko').order('sort_order'),
  ]);

  // 잘못된 UUID 형식도 error로 들어오므로 함께 404 처리
  if (error || !data) notFound();
  const post = data as unknown as Row;

  const translations = Object.fromEntries(
    locales.map((l) => {
      const t = post.post_translations.find((x) => x.locale === l);
      const value: TranslationInput = t
        ? { title: t.title, summary: t.summary ?? '', content: t.content }
        : { title: '', summary: '', content: '' };
      return [l, value];
    }),
  ) as Record<Locale, TranslationInput>;

  return (
    <PostEditor
      key={post.id}
      categories={categories ?? []}
      initial={{
        id: post.id,
        number: post.number,
        publishedAt: post.published_at,
        status: post.status,
        categoryId: post.category_id,
        translations,
      }}
    />
  );
}