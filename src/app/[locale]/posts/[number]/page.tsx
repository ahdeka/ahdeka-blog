import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getAdjacentPosts, getPublishedPost } from '@/lib/posts';
import { getDictionary } from '@/i18n/get-dictionary';
import { AUTHOR_NICKNAME } from '@/lib/site';
import { formatDate, otherLocale } from '@/lib/format';
import { postOgVersion } from '@/lib/og';
import { renderMarkdown } from '@/components/markdown-view';
import CommentSection from '@/components/comments/comment-section';
import { AuthorAvatar } from '@/components/profile';
import ShareButtons from '@/components/share-buttons';
import Toc from '@/components/toc';
import ViewCount from '@/components/view-count';
import { ClockIcon } from '@/components/meta-icons';
import OtherLangLink from './other-lang-link';
import LinkPending from '@/components/link-pending';

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

  // SNS 공유 이미지: 커버가 있으면 커버, 없으면 제목으로 자동 생성한 카드 (src/app/[locale]/posts/[number]/og/[v])
  const images = post.cover
    ? [{ url: post.cover.url, width: post.cover.width, height: post.cover.height }]
    : [{ url: `/${locale}/posts/${n}/og/${postOgVersion(post.updatedAt)}`, width: 1200, height: 630, alt: post.title }];
  const dict = await getDictionary(locale);

  return {
    title: post.title,
    description: post.summary ?? undefined,
    // 공개된 글은 항상 KO·JA 둘 다 있으므로 hreflang을 고정으로 연결
    alternates: {
      canonical: `/${locale}/posts/${n}`,
      languages: { ja: `/ja/posts/${n}`, ko: `/ko/posts/${n}`, 'x-default': `/ja/posts/${n}` },
    },
    openGraph: {
      type: 'article',
      siteName: dict.site.title,
      title: post.title,
      description: post.summary ?? undefined,
      url: `/${locale}/posts/${n}`,
      locale: locale === 'ja' ? 'ja_JP' : 'ko_KR',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags.map((t) => t.name),
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary ?? undefined,
      images,
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
  const { element: body, headings } = renderMarkdown(post.content, { labels: dict.markdown });
  const other = otherLocale(locale);

  return (
    <main className="mx-auto flex max-w-[1120px] items-start gap-16 px-4 pt-14 pb-24 sm:px-8">
      {/* data-to-top-anchor: 맨 위로 버튼이 이 본문 오른쪽 옆에 붙음 (back-to-top.tsx) */}
      <article data-to-top-anchor className="min-w-0 max-w-[740px] flex-[999_1_560px]">
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
              <span className="text-sm font-semibold">{AUTHOR_NICKNAME[locale]}</span>
              <span className="flex items-center gap-4 text-[13px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <ClockIcon />
                  <time dateTime={post.publishedAt} className="mono">
                    {formatDate(post.publishedAt)}
                  </time>
                </span>
                <ViewCount number={n} initial={post.viewCount} label={dict.post.views} />
              </span>
            </div>
          </div>
          <OtherLangLink locale={other} href={`/${other}/posts/${n}`} label={dict.post.otherLang} />
        </div>

        <div className="mt-9">{body}</div>

        {post.tags.length > 0 && (
          <ul aria-label={dict.post.tags} className="mt-12 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/${locale}/tag/${t.slug}`}
                  className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[13.5px] font-medium text-fg-2 transition-colors hover:border-accent hover:text-accent-fg"
                >
                  <LinkPending />
                  <span className="text-fg-3">#</span>
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <ShareButtons
          title={post.title}
          labels={{ share: dict.post.share, close: dict.post.close, copyLink: dict.post.copyLink, copyBtn: dict.post.copyBtn, copied: dict.post.copied }}
        />


        <nav aria-label={dict.post.adjacent} className="mt-8 flex flex-wrap gap-4">
          <AdjacentLink href={prev && `/${locale}/posts/${prev.number}`} label={`← ${dict.post.prev}`} title={prev?.title ?? dict.post.noPrev} />
          <AdjacentLink href={next && `/${locale}/posts/${next.number}`} label={`${dict.post.next} →`} title={next?.title ?? dict.post.noNext} alignRight />
        </nav>

        {/* 댓글은 언어 공통: /ja, /ko 모두 같은 스레드 */}
        <CommentSection postId={post.id} locale={locale} dict={dict.comments} />
      </article>

      {headings.length > 0 && (
        // 헤더가 내려와 있으면 그 아래로 비켜 섬 (--header-offset: globals.css)
        <aside className="sticky top-[calc(var(--header-offset)+2rem)] hidden transition-[top] duration-200 motion-reduce:transition-none flex-[0_1_220px] pt-[140px] lg:block">
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
    // 이전·다음 글은 글 전체를 미리 받아 둠 (post-list.tsx 카드와 같은 이유)
    <Link href={href} prefetch className={`${cls} transition-colors hover:border-accent`}>
      <LinkPending />
      {inner}
    </Link>
  );
}
