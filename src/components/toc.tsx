'use client';

import { useEffect, useState } from 'react';
import type { Heading } from './markdown-view';

// 오른쪽 목차. 화면 위쪽에 가장 가까운 제목을 강조 (scroll-spy)
export default function Toc({ headings, label }: { headings: Heading[]; label: string }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;

    const onScroll = () => {
      // 화면 위에서 30% 지점을 지난 마지막 제목
      const line = window.innerHeight * 0.3;
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) current = el.id;
        else break;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headings]);

  return (
    <nav aria-label={label} className="flex flex-col gap-3">
      <span className="text-xs font-semibold tracking-[0.06em] text-fg-3">{label}</span>
      <ul className="border-l border-line">
        {headings.map((h) => {
          const on = h.id === active;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                aria-current={on ? 'location' : undefined}
                className={`-ml-px block border-l-2 py-1.5 text-sm leading-normal transition-colors ${h.level === 3 ? 'pl-7' : 'pl-3.5'} ${
                  on ? 'border-accent font-semibold text-accent-fg' : 'border-transparent text-fg-3 hover:text-fg'
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
