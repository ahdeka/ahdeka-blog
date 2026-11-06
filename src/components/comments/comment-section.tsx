import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { getCommentThreads, type PublicComment } from '@/lib/comments/queries';
import CommentActions from './comment-actions';
import CommentForm from './comment-form';

type Props = { postId: string; locale: Locale; dict: Dictionary['comments'] };

// 글 상세(ISR)와 함께 서버에서 렌더링 → 댓글이 바뀔 때만 revalidatePath로 다시 그림
export default async function CommentSection({ postId, locale, dict }: Props) {
  const { threads, count } = await getCommentThreads(postId);

  const dateFormat = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  });

  function Item({ c, isReply }: { c: PublicComment; isReply: boolean }) {
    if (c.deleted) {
      return <p className="py-1 text-sm italic text-neutral-400 dark:text-neutral-500">{dict.deleted}</p>;
    }
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{c.nickname}</span>
          {c.isAuthor && (
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-medium leading-none text-white dark:bg-neutral-100 dark:text-neutral-900">
              {dict.author}
            </span>
          )}
          <time dateTime={c.createdAt} className="text-xs tabular-nums text-neutral-500">
            {dateFormat.format(new Date(c.createdAt))}
          </time>
        </div>
        {/* React가 문자열을 이스케이프하므로 HTML이 실행되지 않음. 줄바꿈만 그대로 표시 */}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-[1.85] text-neutral-800 dark:text-neutral-200">
          {c.body}
        </p>
        <CommentActions
          commentId={c.id}
          postId={postId}
          locale={locale}
          dict={dict}
          canReply={!isReply}
          canDelete={!c.isAuthor}
        />
      </div>
    );
  }

  return (
    <section id="comments" aria-labelledby="comments-heading" className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      <h2 id="comments-heading" className="text-xl font-bold tracking-tight">
        {dict.title}
        {count > 0 && <span className="ml-2 text-base font-normal tabular-nums text-neutral-500">{count}</span>}
      </h2>

      {threads.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">{dict.empty}</p>
      ) : (
        <ol className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
          {threads.map((t) => (
            <li key={t.id} id={`comment-${t.id}`} className="scroll-mt-24 py-6">
              <Item c={t} isReply={false} />
              {t.replies.length > 0 && (
                <ol className="mt-5 space-y-5 border-l-2 border-neutral-200 pl-4 sm:pl-6 dark:border-neutral-800">
                  {t.replies.map((r) => (
                    <li key={r.id} id={`comment-${r.id}`} className="scroll-mt-24">
                      <Item c={r} isReply />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-10 rounded-2xl bg-neutral-50 p-5 sm:p-6 dark:bg-neutral-900">
        <h3 className="mb-4 text-sm font-semibold">{dict.write}</h3>
        <CommentForm postId={postId} locale={locale} dict={dict} />
        <p className="mt-4 text-xs leading-relaxed text-neutral-500">{dict.privacy}</p>
      </div>
    </section>
  );
}
