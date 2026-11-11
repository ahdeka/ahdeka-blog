import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { CategoryWithCount } from '@/lib/posts';

type Props = {
  locale: Locale;
  categories: CategoryWithCount[]; // 상위 → 하위 순으로 펼친 목록
  // 지금 보고 있는 카테고리 slug. undefined = 전체글, null = 아무것도 선택 안 함 (태그 화면)
  current: string | undefined | null;
  allCount: number;
  labels: { categories: string; subcategories: string; all: string };
};

// 목록 위 카테고리 탭 (2단계)
// 1줄: 전체 + 상위 카테고리 (밑줄 탭)
// 2줄: 선택된 상위에 하위가 있으면 "전체 + 하위" 알약 버튼
// 공개 글이 없는 카테고리는 숨김 (상위는 하위 글까지 합쳐서 판단)
export default function CategoryTabs({ locale, categories, current, allCount, labels }: Props) {
  const visible = categories.filter((c) => c.total > 0);
  const roots = visible.filter((c) => c.depth === 0);
  const selected = current ? visible.find((c) => c.slug === current) : undefined;
  // 하위 카테고리를 보고 있으면 그 상위 탭이 선택된 것으로
  const activeRoot = selected ? (selected.depth === 0 ? selected : roots.find((r) => r.childSlugs.includes(selected.slug))) : undefined;
  const children = activeRoot ? visible.filter((c) => activeRoot.childSlugs.includes(c.slug)) : [];

  return (
    <div className="flex flex-col">
      <nav aria-label={labels.categories} className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-7 border-b border-line">
          <li>
            <Tab href={`/${locale}`} active={current === undefined} name={labels.all} count={allCount} />
          </li>
          {roots.map((r) => (
            <li key={r.slug}>
              <Tab href={`/${locale}/category/${r.slug}`} active={activeRoot?.slug === r.slug} name={r.name} count={r.total} />
            </li>
          ))}
        </ul>
      </nav>

      {activeRoot && children.length > 0 && (
        <nav aria-label={`${activeRoot.name} ${labels.subcategories}`} className="flex items-center gap-3 pt-4">
          <span className="hidden shrink-0 text-xs font-semibold text-fg-3 sm:block">{labels.subcategories}</span>
          <ul className="no-scrollbar -mr-4 flex min-w-0 gap-2 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:pr-0">
            <li>
              <Pill href={`/${locale}/category/${activeRoot.slug}`} active={selected?.slug === activeRoot.slug} name={labels.all} count={activeRoot.total} />
            </li>
            {children.map((c) => (
              <li key={c.slug}>
                <Pill href={`/${locale}/category/${c.slug}`} active={selected?.slug === c.slug} name={c.name} count={c.total} />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

type ItemProps = { href: string; active: boolean; name: string; count: number };

function Tab({ href, active, name, count }: ItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="-mb-px flex h-12 items-center gap-1.5 border-b-[3px] border-transparent text-[15px] font-bold whitespace-nowrap text-fg-3 transition-colors hover:text-fg aria-[current=page]:border-fg aria-[current=page]:text-fg"
    >
      {name}
      <span className="mono text-xs font-medium">{count}</span>
    </Link>
  );
}

function Pill({ href, active, name, count }: ItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold whitespace-nowrap text-fg-2 transition-colors hover:border-line-strong hover:text-fg aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg"
    >
      {name}
      <span className="mono text-[11.5px] font-medium opacity-70">{count}</span>
    </Link>
  );
}
