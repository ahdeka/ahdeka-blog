import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { locales } from '@/i18n/config';

type PostRow = {
  id: string;
  number: number;
  status: 'draft' | 'published';
  post_translations: { locale: string; title: string }[];
};

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('posts')
    .select('id, number, status, post_translations ( locale, title )')
    .order('number', { ascending: false });

  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  const posts = (data ?? []) as unknown as PostRow[];

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">글 목록</h2>
        <Link
          href="/admin/posts/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          새 글
        </Link>
      </div>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        {posts.map((post) => {
          const title =
            post.post_translations.find((t) => t.locale === 'ko')?.title ??
            post.post_translations[0]?.title ??
            '(제목 없음)';
          return (
            <li key={post.id}>
              <Link
                href={`/admin/posts/${post.id}/edit`}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-10 shrink-0 font-mono text-xs text-neutral-400">#{post.number}</span>
                  <p className="truncate font-medium">{title}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {/* 작성된 언어 표시 */}
                  {locales.map((l) => (
                    <span
                      key={l}
                      className={post.post_translations.some((t) => t.locale === l) ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-300 line-through dark:text-neutral-700'}
                    >
                      {l.toUpperCase()}
                    </span>
                  ))}
                  {post.status === 'published' ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">공개</span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">초안</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {posts.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">글이 없습니다.</li>}
      </ul>
    </section>
  );
}