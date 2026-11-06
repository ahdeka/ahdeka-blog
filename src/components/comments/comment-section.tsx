import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { getCommentThreads, type PublicComment } from '@/lib/comments/queries';
import { formatDateTime } from '@/lib/format';
import CommentActions from './comment-actions';
import CommentBoard from './comment-board';
import CommentForm from './comment-form';

type Props = { postId: string; locale: Locale; dict: Dictionary['comments'] };

// 댓글 본문의 언어를 추정해 lang 속성으로 표시 → 일본어 댓글은 일본어 글꼴·줄바꿈 규칙으로
function guessLang(text: string): 'ja' | 'ko' | undefined {
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[가-힣]/.test(text)) return 'ko';
  return undefined;
}

const TrashIcon = () => (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

const CheckIcon = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

// 글 상세(ISR)와 함께 서버에서 렌더링 → 댓글이 바뀔 때만 revalidatePath로 다시 그림
export default async function CommentSection({ postId, locale, dict }: Props) {
  const { threads, count } = await getCommentThreads(postId);

  function Item({ c, isReply }: { c: PublicComment; isReply: boolean }) {
    if (c.deleted) {
      return (
        <div className="flex items-center gap-3.5">
          <div className="avatar avatar-guest size-9 border-dashed bg-transparent text-fg-3" aria-hidden="true">
            <TrashIcon />
          </div>
          <p className="text-[14.5px] text-fg-3 italic">{dict.deleted}</p>
        </div>
      );
    }
    return (
      <article className="flex gap-3.5">
        <div className={`avatar size-9 text-sm ${c.isAuthor ? '' : 'avatar-guest'}`} aria-hidden="true">
          {c.nickname.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[14.5px]">{c.nickname}</strong>
            {c.isAuthor && (
              <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-accent-soft px-2 text-xs font-semibold text-accent-fg">
                <CheckIcon />
                {dict.author}
              </span>
            )}
            <time dateTime={c.createdAt} className="mono text-[12.5px] text-fg-3">
              {formatDateTime(c.createdAt)}
            </time>
          </div>
          {/* React가 문자열을 이스케이프하므로 HTML이 실행되지 않음. 줄바꿈만 그대로 표시 */}
          <p lang={guessLang(c.body)} className="text-[15.5px] leading-[1.75] break-words whitespace-pre-wrap">
            {c.body}
          </p>
          <CommentActions
            commentId={c.id}
            postId={postId}
            locale={locale}
            dict={dict}
            nickname={c.nickname}
            canReply={!isReply}
            canDelete={!c.isAuthor}
          />
        </div>
      </article>
    );
  }

  return (
    <section id="comments" aria-labelledby="comments-heading" className="mt-12 scroll-mt-8">
      <CommentBoard
        heading={dict.title}
        count={count}
        labels={{ sort: dict.sort, oldest: dict.sortOldest, newest: dict.sortNewest, empty: dict.empty }}
        form={
          <>
            <CommentForm postId={postId} locale={locale} dict={dict} />
            <p className="mt-3 text-xs leading-relaxed text-fg-3">{dict.privacy}</p>
          </>
        }
        threads={threads.map((t) => ({
          id: t.id,
          node: (
            <>
              <Item c={t} isReply={false} />
              {t.replies.length > 0 && (
                <ol className="ml-[17px] flex flex-col gap-[22px] border-l border-line pl-4 sm:pl-[31px]">
                  {t.replies.map((r) => (
                    <li key={r.id} id={`comment-${r.id}`} className="scroll-mt-24">
                      <Item c={r} isReply />
                    </li>
                  ))}
                </ol>
              )}
            </>
          ),
        }))}
      />
    </section>
  );
}
