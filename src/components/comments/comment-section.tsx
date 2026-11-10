import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { getCommentThreads, type PublicComment } from '@/lib/comments/queries';
import { formatDateTime } from '@/lib/format';
import AuthorPhoto from './author-photo';
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

const CheckIcon = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

// 글 상세(ISR)와 함께 서버에서 렌더링 → 댓글이 바뀔 때만 revalidatePath로 다시 그림
export default async function CommentSection({ postId, locale, dict }: Props) {
  const { threads, count } = await getCommentThreads(postId);

  // 아바타는 운영자 댓글에만 (작은 프로필 사진) → 방문자 댓글은 이름·날짜·본문만
  // canReply: 스레드(최상위 댓글)가 삭제된 묘비면 새 답글 불가 (DB 트리거와 같은 규칙)
  function Item({ c, canReply }: { c: PublicComment; canReply: boolean }) {
    if (c.deleted) {
      return <p className="text-[14.5px] text-fg-3 italic">{dict.deleted}</p>;
    }
    // 닉네임을 비워 둔 댓글은 언어별 "익명/匿名" (DB에는 빈 문자열)
    const name = c.nickname || dict.anonymous;
    return (
      <article className="flex min-w-0 flex-col gap-1.5">
        {/* 높이를 사진(22px)에 맞춰 고정 → 운영자 댓글과 방문자 댓글의 줄 간격이 같음 */}
        <div className="flex min-h-[22px] flex-wrap items-center gap-2">
          {c.isAuthor && <AuthorPhoto />}
          <strong className={`text-[14.5px] ${c.nickname ? '' : 'text-fg-2'}`}>{name}</strong>
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
        <CommentActions commentId={c.id} postId={postId} locale={locale} dict={dict} nickname={name} canReply={canReply} />
      </article>
    );
  }

  return (
    <section id="comments" aria-labelledby="comments-heading" className="mt-12 scroll-mt-8">
      <CommentBoard
        heading={dict.title}
        count={count}
        labels={{ sort: dict.sort, oldest: dict.sortOldest, newest: dict.sortNewest, empty: dict.empty }}
        form={<CommentForm postId={postId} locale={locale} dict={dict} />}
        threads={threads.map((t) => ({
          id: t.id,
          node: (
            <>
              <Item c={t} canReply />
              {t.replies.length > 0 && (
                <ol className="flex flex-col gap-[22px] border-l border-line pl-4 sm:pl-5">
                  {t.replies.map((r) => (
                    <li key={r.id} id={`comment-${r.id}`} className="scroll-mt-24">
                      {/* 답글에도 답글 버튼 → 같은 스레드 맨 아래에 붙음 */}
                      <Item c={r} canReply={!t.deleted} />
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
