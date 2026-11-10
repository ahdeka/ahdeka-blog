import Link from 'next/link';
import { fill } from '@/lib/format';

type Props = {
  page: number;
  totalPages: number;
  href: (n: number) => string;
  labels: { nav: string; prev: string; next: string; page: string }; // page: "{n}페이지" — 화면 낭독기용
};

// 표시할 번호: 7칸 이하면 전부, 그 이상이면 처음·끝 + 현재 주변 (칸 수를 7개로 고정 → 페이지를 넘겨도 폭이 흔들리지 않음)
// 예) 1 … 4 5 6 … 20 / 1 2 3 4 5 … 20
function pageItems(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(2, page - 1);
  let end = Math.min(total - 1, page + 1);
  if (page <= 4) [start, end] = [2, 5];
  if (page >= total - 3) [start, end] = [total - 4, total - 1];
  const items: (number | 'gap')[] = [1];
  if (start > 2) items.push('gap');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push('gap');
  items.push(total);
  return items;
}

const box = 'mono grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm';

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

// 목록 아래 페이지 번호. 한 페이지뿐이면 아무것도 그리지 않음
export default function Pagination({ page, totalPages, href, labels }: Props) {
  if (totalPages <= 1) return null;

  const arrow = (n: number, dir: 'left' | 'right', label: string) =>
    n < 1 || n > totalPages ? (
      <span className={`${box} text-fg-3 opacity-40`} aria-hidden="true">
        <Chevron dir={dir} />
      </span>
    ) : (
      <Link href={href(n)} aria-label={label} rel={dir === 'left' ? 'prev' : 'next'} className={`${box} text-fg-2 hover:bg-subtle hover:text-fg`}>
        <Chevron dir={dir} />
      </Link>
    );

  return (
    <nav aria-label={labels.nav} className="mt-10 flex items-center justify-center gap-1">
      {arrow(page - 1, 'left', labels.prev)}
      {pageItems(page, totalPages).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className={`${box} text-fg-3`} aria-hidden="true">
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" aria-label={fill(labels.page, { n: item })} className={`${box} bg-fg font-bold text-bg`}>
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-label={fill(labels.page, { n: item })}
            className={`${box} text-fg-2 hover:bg-subtle hover:text-fg`}
          >
            {item}
          </Link>
        ),
      )}
      {arrow(page + 1, 'right', labels.next)}
    </nav>
  );
}
