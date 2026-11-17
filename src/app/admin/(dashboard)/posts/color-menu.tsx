'use client';

import { useState } from 'react';
import { TEXT_COLORS, type TextColor } from '@/lib/markdown-extras';

// 에디터 툴바의 글자색 버튼 → {red}…{/} (markdown-keys.ts toggleColor)
// 같은 색을 다시 고르면 해제, "색 없음" = 해제

const LABELS: Record<TextColor, string> = {
  red: '빨강',
  blue: '파랑',
  teal: '청록 (대표색)',
  gray: '회색',
};

type Props = { disabled?: boolean; className: string; onPick: (color: TextColor | null) => void };

export default function ColorMenu({ disabled, className, onPick }: Props) {
  const [open, setOpen] = useState(false);

  const pick = (color: TextColor | null) => {
    setOpen(false);
    onPick(color);
  };

  return (
    <div
      className="relative"
      // 메뉴 밖으로 포커스가 나가면 닫음
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label="글자색"
        title="글자색"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${className} ${open ? 'bg-bg text-fg' : ''}`}
      >
        <span className="flex flex-col items-center leading-none">
          <span className="font-sans font-bold">A</span>
          <span className="mt-[3px] h-[3px] w-3.5 rounded-full bg-(--tc-red)" />
        </span>
      </button>
      {open && (
        <div role="menu" aria-label="글자색" className="absolute top-full left-0 z-20 mt-1 flex min-w-[160px] flex-col rounded-[10px] border border-line bg-bg p-1 shadow-lg">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="menuitem"
              onClick={() => pick(c)}
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-fg hover:bg-subtle"
            >
              <span className={`tc-${c} w-4 text-center font-bold`}>가</span>
              {LABELS[c]}
            </button>
          ))}
          <span className="mx-1 my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(null)}
            className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-fg-2 hover:bg-subtle"
          >
            <span className="w-4 text-center text-fg-3">∅</span>
            색 없음
          </button>
        </div>
      )}
    </div>
  );
}
