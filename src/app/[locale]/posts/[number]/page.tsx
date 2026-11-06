import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getAdjacentPosts, getPublishedPost } from '@/lib/posts';
import { getDictionary } from '@/i18n/get-dictionary';
import { AUTHOR_NAME } from '@/lib/site';
import { fill, formatDate, otherLocale, readingMinutes } from '@/lib/format';
import { renderMarkdown } from '@/components/markdown-view';
import CommentSection from '@/components/comments/comment-section';
import { AuthorAvatar } from '@/components/profile';
import ShareButtons from '@/components/share-buttons';
import Toc from '@/components/toc';
import OtherLangLink from './other-lang-link';

type Props = { params: Promise<{ locale: string; number: string }> };

// 빌드 시 미리 만들지 않고, 첫 요청 때 렌더링 → 캐시 (ISR)
// 빈 배열이어도 반드시 정의해야 ISR이 됨 (없으면 매 요청 동적 렌더링)
export function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

// "12" 같은 양의 정수만 허용. 그 외(/posts/abc)는 DB 조회 없이 바로 404
function parseNumber(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, number } = await params;
  const n = parseNumber(number);
  if (!n || !isLocale(locale)) return {};

  const post = await getPublishedPost(n, locale);
  if (!post) return {};

  return {
    title: post.title,
    description: post.summary ?? undefined,
    // 공개된 글은 항상 KO·JA 둘 다 있으므로 hreflang을 고정으로 연결
    alternates: {
      canonical: `/${locale}/posts/${n}`,
      languages: { ja: `/ja/posts/${n}`, ko: `/ko/posts/${n}`, 'x-default': `/ja/posts/${n}` },
    },
  };
}

const Chevron = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export default async function PostPage({ params }: Props) {
  const { locale, number } = await params;
  const n = parseNumber(number);
  if (!n || !isLocale(locale)) notFound();

  const [post, dict] = await Promise.all([getPublishedPost(n, locale), getDictionary(locale)]);
  if (!post) notFound();

  const { prev, next } = await getAdjacentPosts(post.publishedAt, locale);
  const { element: body, headings } = renderMarkdown(post.content);
  const other = otherLocale(locale);

  return (
    <main className="mx-auto flex max-w-[1120px] items-start gap-16 px-4 pt-14 pb-24 sm:px-8">
      <article className="min-w-0 max-w-[740px] flex-[999_1_560px]">
        <nav aria-label={dict.post.breadcrumb} className="flex items-center gap-1.5 text-sm text-fg-3">
          <Link href={`/${locale}`} className="hover:text-fg">
            {dict.nav.blog}
          </Link>
          {post.category?.parent && (
            <>
              <Chevron />
              <Link href={`/${locale}/category/${post.category.parent.slug}`} className="hover:text-fg">
                {post.category.parent.name}
              </Link>
            </>
          )}
          {post.category && (
            <>
              <Chevron />
              <Link href={`/${locale}/category/${post.category.slug}`} className="font-semibold text-accent-fg hover:text-fg">
                {post.category.name}
              </Link>
            </>
          )}
        </nav>

        <h1 className="mt-4 text-[30px] leading-(--lh-title) font-bold tracking-[-0.025em] sm:text-[38px]">{post.title}</h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-7">
          <div className="flex items-center gap-3">
            <AuthorAvatar size={36} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{AUTHOR_NAME}</span>
              <span className="text-[13px] text-fg-3">
                <time dateTime={post.publishedAt} className="mono">
                  {formatDate(post.publishedAt)}
                </time>{' '}
                · {fill(dict.post.readingTime, { n: readingMinutes(post.content) })}
              </span>
            </div>
          </div>
          <OtherLangLink locale={other} href={`/${other}/posts/${n}`} label={dict.post.otherLang} />
        </div>

        <div className="mt-9">{body}</div>

        <ShareButtons title={post.title} copyLabel={dict.post.copyUrl} copiedLabel={dict.post.copied} shareXLabel={dict.post.shareX} />


        <nav aria-label={dict.post.adjacent} className="mt-8 flex flex-wrap gap-4">
          <AdjacentLink href={prev && `/${locale}/posts/${prev.number}`} label={`← ${dict.post.prev}`} title={prev?.title ?? dict.post.noPrev} />
          <AdjacentLink href={next && `/${locale}/posts/${next.number}`} label={`${dict.post.next} →`} title={next?.title ?? dict.post.noNext} alignRight />
        </nav>

        {/* 댓글은 언어 공통: /ja, /ko 모두 같은 스레드 */}
        <CommentSection postId={post.id} locale={locale} dict={dict.comments} />
      </article>

      {headings.length > 0 && (
        <aside className="sticky top-8 hidden flex-[0_1_220px] pt-[140px] lg:block">
          <Toc headings={headings} label={dict.post.toc} />
        </aside>
      )}
    </main>
  );
}

function AdjacentLink({ href, label, title, alignRight }: { href: string | null; label: string; title: string; alignRight?: boolean }) {
  const cls = `flex flex-[1_1_280px] flex-col gap-2 rounded-[14px] border border-line px-[22px] py-5 ${alignRight ? 'text-right' : ''}`;
  const inner = (
    <>
      <span className="text-[13px] text-fg-3">{label}</span>
      <span className="clamp2 text-[15.5px] leading-(--lh-title) font-semibold">{title}</span>
    </>
  );
  if (!href) return <div className={`${cls} opacity-60`}>{inner}</div>;
  return (
    <Link href={href} className={`${cls} transition-colors hover:border-accent`}>
      {inner}
    </Link>
  );
}
