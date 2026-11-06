import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import CommentRowActions from './comment-row-actions';

type Row = {
  id: string;
  parent_id: string | null;
  nickname: string;
  body: string;
  is_author: boolean;
  created_at: string;
  deleted_at: string | null;
  post: { number: number; post_translations: { locale: string; title: string }[] } | null;
};

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

export default async function AdminCommentsPage() {
  const { supabase } = await requireAdmin();

  // 최근 댓글 200개 (관리자는 RLS "admin all"로 초안 글의 댓글·삭제 표시까지 모두 보임)
  const { data, error } = await supabase
    .from('comments')
    .select('id, parent_id, nickname, body, is_author, created_at, deleted_at, post:posts ( number, post_translations ( locale, title ) )')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows = (data ?? []) as unknown as Row[];
  // 삭제 확인 문구용: 답글이 달린 댓글인지
  const parentsWithReplies = new Set(rows.filter((r) => r.parent_id).map((r) => r.parent_id));

  return (
    <section className="mx-auto max-w-5xl">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">최근 댓글</h2>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        {rows.map((c) => {
          const title =
            c.post?.post_translations.find((t) => t.locale === 'ko')?.title ?? c.post?.post_translations[0]?.title ?? '';
          return (
            <li key={c.id} className="px-4 py-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                {c.post && (
                  <Link href={`/ko/posts/${c.post.number}#comment-${c.id}`} target="_blank" className="hover:underline">
                    #{c.post.number} {title}
                  </Link>
                )}
                <span>·</span>
                <time dateTime={c.created_at}>{dateFormat.format(new Date(c.created_at))}</time>
                {c.parent_id && <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">답글</span>}
              </div>
              {c.deleted_at ? (
                <p className="mt-2 text-sm italic text-neutral-400">작성자가 삭제한 댓글 (답글이 있어 자리만 남음)</p>
              ) : (
                <>
                  <p className="mt-2 text-sm font-semibold">
                    {c.nickname}
                    {c.is_author && (
                      <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                        작성자
                      </span>
                    )}
                  </p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {c.body}
                  </p>
                </>
              )}
              <CommentRowActions id={c.id} canReply={!c.deleted_at} hasReplies={parentsWithReplies.has(c.id)} />
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">댓글이 없습니다.</li>}
      </ul>
    </section>
  );
}
