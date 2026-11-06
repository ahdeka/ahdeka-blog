'use client';

import { useState } from 'react';

type Props = {
  text?: string; // 없으면 현재 페이지 URL
  label: string;
  doneLabel: string;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode; // 아이콘 등 (label 앞에 표시)
};

export default function CopyButton({ text, label, doneLabel, className, ariaLabel, children }: Props) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text ?? window.location.href);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // 클립보드 권한이 없는 환경(http 등)에서는 조용히 무시
    }
  }

  return (
    <button type="button" onClick={copy} className={className} aria-label={ariaLabel}>
      {children}
      <span aria-live="polite">{done ? doneLabel : label}</span>
    </button>
  );
}
