'use client';

import { useEffect, useState } from 'react';

const BTN = 44; // 버튼 크기 (size-11)
// 본문 오른쪽 끝 → 버튼 왼쪽까지: 본문·목차 사이 간격(gap-16 = 64) + 목차 칸(220)의 오른쪽 끝에 버튼이 맞도록
// 목차가 없는 글도 같은 자리 (posts/[number]/page.tsx 레이아웃 값과 맞출 것)
const OFFSET = 64 + 220 - BTN;
const EDGE = 16; // 화면 가장자리와의 최소 여백

// 떠 있는 "맨 위로" 버튼. 한 화면 이상 내려갔을 때만 나타남
// - 기본 위치: 콘텐츠 영역(1120px) 오른쪽 끝 (globals.css .back-to-top)
// - 글 상세처럼 data-to-top-anchor가 있는 페이지: 본문 오른쪽, 목차 칸 오른쪽 끝 아래
//   화면이 좁아 옆에 자리가 없으면 화면 오른쪽 가장자리에 붙음
// - 숨김 상태에선 invisible → 키보드 Tab 순서에서도 빠짐
export default function BackToTop({ label }: { label: string }) {
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    // 페이지 이동·로딩 화면 교체로 본문이 바뀔 수 있어 매번 다시 찾음 (보일 때만 계산)
    const update = () => {
      const visible = window.scrollY > window.innerHeight;
      setShow(visible);
      if (!visible) return;
      const anchor = document.querySelector('[data-to-top-anchor]');
      if (!anchor) return setLeft(null);
      const vw = document.documentElement.clientWidth;
      setLeft(Math.min(anchor.getBoundingClientRect().right + OFFSET, vw - BTN - EDGE));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  function toTop() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    // 버튼이 사라지면 포커스가 갈 곳이 없어지므로, 키보드 사용자를 위해 로고 링크로 옮김
    document.querySelector<HTMLElement>('.site-header a')?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={label}
      title={label}
      style={left === null ? undefined : { left, right: 'auto' }}
      className={`back-to-top icon-btn fixed z-30 size-11 rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-[opacity,translate,visibility] duration-200 motion-reduce:transition-none ${
        show ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-2 opacity-0'
      }`}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
