'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { CategoryWithCount } from '@/lib/posts';

type Props = {
  locale: Locale;
  categories: CategoryWithCount[]; // 상위 → 하위 순으로 펼친 목록
  current?: string; // 지금 보고 있는 카테고리 slug (없으면 전체글)
  allCount: number;
  labels: { categories: string; all: string; toggle: string };
};

export default function CategoryTree({ locale, categories, current, allCount, labels }: Props) {
  // 공개 글이 없는 카테고리는 숨김 (상위는 하위 글까지 합쳐서 판단)
  const visible = categories.filter((c) => c.total > 0);
  const groups = visible
    .filter((c) => c.depth === 0)
    .map((root) => ({ root, children: visible.filter((c) => root.childSlugs.includes(c.slug)) }));

  // 기본은 모두 펼침. 접은 그룹만 기억
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (slug: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });

  return (
    <nav aria-label={labels.categories} className="flex flex-col border-t border-line pt-6">
      <span className="px-2.5 pb-3 text-[13px] font-semibold text-fg-2">{labels.categories}</span>

      <Link href={`/${locale}`} aria-current={!current ? 'page' : undefined} className="tree-item min-h-11 font-semibold">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
        </svg>
        <span className="flex-1">{labels.all}</span>
        <span className="mono text-xs">{allCount}</span>
      </Link>

      {groups.map(({ root, children }) => {
        // 지금 보고 있는 카테고리가 이 그룹 안에 있으면 접혀 있어도 펼쳐 보여 줌
        const open = !collapsed.has(root.slug) || children.some((c) => c.slug === current);
        const listId = `cat-${root.slug}`;
        return (
          <div key={root.slug} className="mt-3 flex flex-col">
            <div className="flex items-center">
              {children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggle(root.slug)}
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-label={`${root.name} ${labels.toggle}`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-subtle hover:text-fg"
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${open ? '' : '-rotate-90'}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              ) : (
                <span className="size-7 shrink-0" />
              )}
              <Link
                href={`/${locale}/category/${root.slug}`}
                aria-current={root.slug === current ? 'page' : undefined}
                // 선택 상태 색(.tree-item[aria-current])을 덮어쓰지 않도록 text-fg는 비선택일 때만
                className={`tree-item flex-1 pl-1.5 font-bold ${root.slug === current ? '' : 'text-fg'}`}
              >
                <span className="flex-1">{root.name}</span>
                <span className="mono text-xs font-normal text-fg-2">{root.total}</span>
              </Link>
            </div>

            {children.length > 0 && open && (
              <div id={listId} className="mt-1 ml-[13px] flex flex-col gap-0.5 border-l border-line pl-3">
                {children.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/${locale}/category/${c.slug}`}
                    aria-current={c.slug === current ? 'page' : undefined}
                    className="tree-item min-h-10"
                  >
                    <span className="flex-1">{c.name}</span>
                    <span className="mono text-xs text-fg-3">{c.total}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
