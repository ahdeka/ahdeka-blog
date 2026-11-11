import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { CategoryRef } from '@/lib/posts';

// 목록 화면 맨 위의 터미널 프롬프트 한 줄 ("~/posts/dev/java-spring $ ls")
// - 경로 부분 = 지금 위치 (pwd). 각 조각은 그 위치로 가는 링크 → 상위 카테고리 이동 경로(breadcrumb) 역할도 함
// - 명령 부분 = 지금 화면이 하는 일 (목록 ls / 태그 grep / 검색 grep)
// 경로는 카테고리 slug(영문 소문자)로 표시해 터미널처럼 보이게 하고, 실제 이름은 title·화면 낭독기용 aria-label로
export type TerminalScope =
  | { type: 'home' }
  | { type: 'category'; path: CategoryRef[] } // 상위 → 지금 카테고리 순
  | { type: 'tag'; slug: string }
  | { type: 'search'; q: string };

type Props = { locale: Locale; scope: TerminalScope; page: number; label: string };

// 따옴표 안에 들어갈 문자열 (검색어에 ' 가 있으면 셸처럼 이스케이프한 모양으로)
const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

function command(scope: TerminalScope, page: number) {
  const paging = page > 1 ? ` --page=${page}` : '';
  switch (scope.type) {
    case 'tag':
      return `grep -l '#${scope.slug}'${paging}`;
    case 'search':
      return scope.q ? `grep -ri ${quote(scope.q)}${paging}` : 'grep -ri';
    default:
      return `ls -t${paging}`;
  }
}

export default function TerminalPath({ locale, scope, page, label }: Props) {
  const path = scope.type === 'category' ? scope.path : [];
  const cmd = command(scope, page);

  return (
    <nav aria-label={label} className="mono flex min-w-0 flex-wrap items-center text-[13.5px] font-semibold sm:text-sm">
      <Link href={`/${locale}`} className="text-accent-fg hover:underline hover:underline-offset-4">
        ~/posts
      </Link>
      {path.map((c, i) => (
        <span key={c.slug} className="flex items-center">
          <span className="text-fg-3" aria-hidden="true">
            /
          </span>
          {i === path.length - 1 ? (
            <span aria-current="page" title={c.name} className="text-accent-fg">
              {c.slug}
              <span className="sr-only"> ({c.name})</span>
            </span>
          ) : (
            <Link href={`/${locale}/category/${c.slug}`} title={c.name} className="text-accent-fg hover:underline hover:underline-offset-4">
              {c.slug}
              <span className="sr-only"> ({c.name})</span>
            </Link>
          )}
        </span>
      ))}
      <span className="px-2 text-fg-3" aria-hidden="true">
        $
      </span>
      {/* 명령어는 장식 (화면 낭독기는 경로만 읽음) */}
      <span aria-hidden="true" className="min-w-0 font-medium break-all text-fg-2">
        {cmd}
        <span className="term-cursor" />
      </span>
    </nav>
  );
}
