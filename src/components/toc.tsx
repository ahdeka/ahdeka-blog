'use client';

import { useEffect, useRef, useState } from 'react';
import type { Heading } from './markdown-view';

// 이 높이(px)를 지난 마지막 제목을 강조 (scroll-spy)
// 제목의 scroll-margin-top(24px)보다 약간 아래 → 목차를 눌러 이동한 제목이 그대로 강조됨
// (예전엔 화면 30% 지점이라, 짧은 구역이면 다음 제목까지 선을 넘어 다음 항목이 강조됐음)
const ACTIVE_LINE = 96;

// 오른쪽 목차. 화면 위쪽에 가장 가까운 제목을 강조
export default function Toc({ headings, label }: { headings: Heading[]; label: string }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);
  // 목차를 눌러 이동하는 동안엔 scroll-spy를 멈춤 (누른 항목이 바로 강조되도록)
  const locked = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const lockBriefly = () => {
    locked.current = true;
    clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => (locked.current = false), 150);
  };

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;

    const onScroll = () => {
      // 이동 중 발생하는 스크롤은 무시하고, 멈춘 뒤 150ms 지나면 다시 따라감
      if (locked.current) return lockBriefly();
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= ACTIVE_LINE) current = el.id;
        else break;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(unlockTimer.current);
    };
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
                onClick={() => {
                  lockBriefly();
                  setActive(h.id);
                }}
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
