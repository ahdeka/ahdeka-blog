'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/config';
import { SearchIcon } from './search-status';

// 공개 화면 로딩 스켈레톤. [locale] 아래 loading.tsx들이 모두 이 컴포넌트를 그대로 씀
// 왜 주소로 고르나: loading.tsx는 "그 폴더의 하위 화면이 바뀔 때" 적용됨
//   → 같은 loading.tsx가 홈 → 글, 글 → 소개 등 여러 화면으로의 이동에 쓰이므로, 도착할 주소를 보고 모양을 고름
//   (이동이 시작되면 usePathname은 이미 새 주소)
// 레이아웃 값(여백·폭·줄 높이)은 실제 화면과 같게 맞춰서, 내용이 들어올 때 화면이 덜컥 움직이지 않게 함
// - blog-index.tsx (목록·검색) / [locale]/posts/[number]/page.tsx (글) 를 고치면 여기도 같이 맞출 것

const LOADING: Record<Locale, string> = { ko: '불러오는 중', ja: '読み込み中' };

type Variant = 'list' | 'search' | 'article' | 'about';

function variantOf(rest: string[]): Variant {
  if (rest[0] === 'search') return 'search';
  if (rest[0] === 'posts' && rest[1]) return 'article';
  if (rest[0] === 'about') return 'about';
  return 'list';
}

export default function RouteSkeleton() {
  const [, first = '', ...rest] = usePathname().split('/');
  const locale: Locale = isLocale(first) ? first : 'ko';
  const variant = variantOf(rest);
  const label = LOADING[locale];

  if (variant === 'article' || variant === 'about') return <ArticleSkeleton label={label} about={variant === 'about'} />;
  return <ListSkeleton label={label} search={variant === 'search'} />;
}

// 막대 하나. 줄 높이(wrap)만큼 자리를 잡고 그 안에 글자 높이 정도의 막대를 가운데 놓음
// → 실제 글줄과 높이가 같아서 내용으로 바뀔 때 아래쪽이 밀리지 않음
function Bone({ className = '', wrap }: { className?: string; wrap?: string }) {
  if (!wrap) return <span className={`skel ${className}`} />;
  return (
    <span className={`flex items-center ${wrap}`}>
      <span className={`skel ${className}`} />
    </span>
  );
}

// 화면 낭독기에는 "불러오는 중"만 읽히고, 막대들은 숨김
function Screen({ label, kind, className, children }: { label: string; kind: Variant; className: string; children: React.ReactNode }) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <main aria-hidden="true" data-skeleton={kind} className={`skel-screen ${className}`}>
        {children}
      </main>
    </>
  );
}

/* ----------------------------- 목록 · 검색 ----------------------------- */

// 카드 하나 (post-list.tsx: 카테고리 줄 h-5 / 제목 2줄까지 / 요약 2줄 높이 고정 / 날짜 줄)
function CardSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <li className="flex flex-col gap-2 border-b border-line py-7 last:border-b-0 sm:gap-2.5 sm:py-8">
      <Bone wrap="h-5" className="h-3 w-20" />
      <Bone wrap="h-[26px] sm:h-[30px]" className={`h-[17px] sm:h-5 ${titleWidth}`} />
      <span className="flex min-h-[3.4em] flex-col justify-around text-[15px] sm:text-[15.5px]">
        <span className="skel h-3 w-full" />
        <span className="skel h-3 w-[64%]" />
      </span>
      <Bone wrap="mt-0.5 h-5" className="h-3 w-44" />
    </li>
  );
}

// 카드 제목 폭을 조금씩 달리해서 "막대 더미"가 아니라 목록처럼 보이게
const TITLE_WIDTHS = ['w-[72%]', 'w-[56%]', 'w-[80%]', 'w-[48%]', 'w-[66%]'];

function ListSkeleton({ label, search }: { label: string; search: boolean }) {
  const q = search ? <SearchQuery /> : null;

  return (
    <Screen label={label} kind={search ? 'search' : 'list'} className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-6">
      {/* blog-index.tsx 위쪽: 터미널 경로 + 제목 */}
      <div className="flex flex-col gap-2.5 pt-10 pb-7 sm:pt-12">
        <Bone wrap="h-[20px] sm:h-[21px]" className="h-3.5 w-44" />
        <Bone wrap="h-[34px] sm:h-[39px]" className="h-6 w-[min(18rem,70%)] sm:h-7" />
      </div>

      {search ? (
        q
      ) : (
        // 카테고리 탭 줄 (밑줄 탭, 높이 48px)
        <div className="flex h-12 items-center gap-7 overflow-hidden border-b border-line">
          {['w-10', 'w-14', 'w-12', 'w-16'].map((w) => (
            <span key={w} className={`skel h-3.5 shrink-0 ${w}`} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-x-16 gap-y-14">
        <section className="min-w-0 flex-[999_1_560px]">
          {search && (
            <div className="flex h-[45px] items-start border-b border-line">
              <Bone wrap="h-7" className="h-4 w-48" />
            </div>
          )}
          <ul>
            {TITLE_WIDTHS.map((w, i) => (
              <CardSkeleton key={i} titleWidth={w} />
            ))}
          </ul>
        </section>

        {/* 오른쪽 사이드바: 프로필 + TOP 5 */}
        <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-10 lg:max-w-[280px] lg:pt-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="skel size-12 shrink-0 rounded-full" />
              <span className="flex flex-col gap-2">
                <span className="skel h-3.5 w-16" />
                <span className="skel h-2.5 w-20" />
              </span>
            </div>
            <span className="flex flex-col gap-3 py-1.5">
              <span className="skel h-2.5 w-[92%]" />
              <span className="skel h-2.5 w-[78%]" />
              <span className="skel h-2.5 w-[50%]" />
            </span>
            {/* GitHub · 메일 버튼 */}
            <span className="flex gap-2">
              <span className="skel size-9 rounded-[10px]" />
              <span className="skel size-9 rounded-[10px]" />
            </span>
          </div>
          <div className="flex flex-col gap-4">
            <span className="skel mb-1 h-3.5 w-16" />
            {['w-[88%]', 'w-[70%]', 'w-[80%]', 'w-[60%]', 'w-[75%]'].map((w) => (
              <span key={w} className="flex items-center gap-3">
                <span className="skel h-3 w-3 shrink-0" />
                <span className={`skel h-3 ${w}`} />
              </span>
            ))}
          </div>
        </aside>
      </div>
    </Screen>
  );
}

// 검색 화면: 방금 입력한 검색어를 그대로 보여 줌 (입력창이 막대로 바뀌었다가 돌아오는 깜빡임 없이)
// search-form.tsx와 같은 모양. 입력은 받지 않는 표시용
// 검색어 읽기(useSearchParams)는 빌드 시 미리 그릴 수 없으므로 그 부분만 Suspense로 감쌈 (빌드 때는 빈 입력창)
function SearchQuery() {
  return (
    <Suspense fallback={<SearchBox q="" />}>
      <SearchBoxWithQuery />
    </Suspense>
  );
}

function SearchBoxWithQuery() {
  return <SearchBox q={useSearchParams().get('q') ?? ''} />;
}

function SearchBox({ q }: { q: string }) {
  return (
    <div className="mb-8">
      <div className="field-box flex h-[46px] items-center gap-2 pr-1.5 pl-3.5">
        <span className="text-fg-3">
          <SearchIcon />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{q}</span>
        <span className="skel h-8 w-14 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

/* --------------------------------- 글 --------------------------------- */

// [locale]/posts/[number]/page.tsx: 경로 → 제목(2줄) → 작성자·날짜 줄 → 본문
// 소개 페이지(/about)는 가운데 정렬 한 단 + 경로·목차 없음 (about/page.tsx)
const PARAGRAPHS = [
  ['w-full', 'w-full', 'w-[92%]', 'w-[48%]'],
  ['w-full', 'w-[96%]', 'w-[70%]'],
  ['w-full', 'w-full', 'w-[84%]', 'w-full', 'w-[36%]'],
];

function ArticleSkeleton({ label, about }: { label: string; about: boolean }) {
  return (
    <Screen
      label={label}
      kind={about ? 'about' : 'article'}
      className={`mx-auto flex items-start gap-16 px-4 pt-14 pb-24 sm:px-8 ${about ? 'max-w-[740px]' : 'max-w-[1120px]'}`}
    >
      <div className="min-w-0 max-w-[740px] flex-[999_1_560px]">
        {/* 경로 (블로그 › 카테고리) */}
        {!about && (
          <span className="mb-4 flex h-5 items-center gap-2.5">
            <span className="skel h-3 w-10" />
            <span className="skel h-3 w-16" />
          </span>
        )}

        {/* 제목: 30px / sm 38px 글자, 줄 높이 1.35 */}
        <span className="flex flex-col">
          <Bone wrap="h-[41px] sm:h-[51px]" className="h-[26px] w-[92%] sm:h-8" />
          <Bone wrap="h-[41px] sm:h-[51px]" className="h-[26px] w-[54%] sm:h-8" />
        </span>

        {/* 작성자 · 날짜 · 조회수 | 다른 언어로 읽기 */}
        <span className="mt-6 flex items-center gap-3 border-b border-line pb-7">
          <span className="skel size-9 shrink-0 rounded-full" />
          <span className="flex flex-col gap-2">
            <span className="skel h-3.5 w-14" />
            <span className="skel h-3 w-36" />
          </span>
          <span className="skel ml-auto h-9 w-[120px] rounded-full" />
        </span>

        {/* 본문 */}
        <span className="mt-9 flex flex-col gap-9">
          {PARAGRAPHS.map((lines, i) => (
            <span key={i} className="flex flex-col gap-3.5">
              {lines.map((w, j) => (
                <span key={j} className={`skel h-3.5 ${w}`} />
              ))}
            </span>
          ))}
          <span className="skel mt-3 h-6 w-48" />
          <span className="flex flex-col gap-3.5">
            {['w-full', 'w-[88%]', 'w-[60%]'].map((w) => (
              <span key={w} className={`skel h-3.5 ${w}`} />
            ))}
          </span>
        </span>
      </div>

      {/* 목차 (넓은 화면. 실제로는 소제목이 있는 글에만 있음) */}
      {!about && (
        <span className="hidden flex-[0_1_220px] flex-col gap-4 pt-[140px] lg:flex">
          <span className="skel h-3 w-10" />
          <span className="flex flex-col gap-4 border-l-2 border-line pl-4">
            {['w-[70%]', 'w-[55%]', 'w-[80%]'].map((w) => (
              <span key={w} className={`skel h-3 ${w}`} />
            ))}
          </span>
        </span>
      )}
    </Screen>
  );
}
