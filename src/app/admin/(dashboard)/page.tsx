import { requireAdmin } from '@/lib/auth/admin';

type PostRow = {
  id: string;
  slug: string;
  updated_at: string;
  deleted_at: string | null;
  post_translations: { locale: string; title: string; status: string }[];
};

export default async function AdminHomePage() {
  // ⚠️ 레이아웃에서 이미 확인했어도 페이지에서 다시 확인 (Next.js는 layout과 page를 병렬로 렌더링함)
  const { supabase } = await requireAdmin();

  // 관리자 세션이라 RLS가 초안·삭제된 글까지 보여줌
  const { data, error } = await supabase
    .from('posts')
    .select('id, slug, updated_at, deleted_at, post_translations ( locale, title, status )')
    .order('updated_at', { ascending: false });

  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  const posts = (data ?? []) as unknown as PostRow[];

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold tracking-tight">글 목록</h2>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        {posts.map((post) => (
          <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {post.post_translations[0]?.title ?? '(제목 없음)'}
              </p>
              <p className="font-mono text-xs text-neutral-500">/{post.slug}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {post.deleted_at && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300">삭제됨</span>
              )}
              {post.post_translations.map((t) => (
                <span
                  key={t.locale}
                  className={
                    t.status === 'published'
                      ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  }
                >
                  {t.locale.toUpperCase()} · {t.status === 'published' ? '공개' : '초안'}
                </span>
              ))}
            </div>
          </li>
        ))}
        {posts.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">글이 없습니다.</li>}
      </ul>
    </section>
  );
}