'use client';

import { useEffect } from 'react';

// 이 거리(px) 이상 움직였을 때만 방향을 판단 (손가락 떨림·관성 스크롤 끝의 흔들림 무시)
const DELTA = 6;
// 목차·"#" 링크로 이동한 직후 이만큼(ms)은 헤더를 다시 띄우지 않음
const JUMP_LOCK = 300;

// 헤더 자동 숨김 (렌더링 없음, <html>에 상태만 기록)
// - 아래로 읽어 내려가면 숨기고, 조금이라도 위로 올리면 다시 보임 → 검색·언어·테마 버튼을 어디서든 쓸 수 있음
// - data-header="hidden" → globals.css의 .site-header가 위로 밀려 올라감
// - --header-h: 헤더 실제 높이 (좁은 화면에서 두 줄이 되면 높이가 바뀜). 목차 sticky 위치 계산에 사용
export default function HeaderAutoHide() {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;

    const ro = new ResizeObserver(() => root.style.setProperty('--header-h', `${header.offsetHeight}px`));
    ro.observe(header);

    const setHidden = (hidden: boolean) => {
      if (hidden) root.dataset.header = 'hidden';
      else delete root.dataset.header;
    };

    let lastY = window.scrollY;
    let lockUntil = 0;

    const onScroll = () => {
      const y = window.scrollY;
      // 맨 위 근처(헤더 높이 이내, iOS 바운스의 음수 포함)에서는 항상 보임
      if (y <= header.offsetHeight) {
        setHidden(false);
        lastY = y;
        return;
      }
      if (performance.now() < lockUntil) {
        lastY = y;
        return;
      }
      const d = y - lastY;
      if (Math.abs(d) < DELTA) return;
      setHidden(d > 0);
      lastY = y;
    };

    // 같은 페이지 안 링크(목차, 제목 옆 "#", #comments)로 위쪽 제목에 이동하면
    // "위로 스크롤"로 판단돼 헤더가 내려와 제목을 가리므로, 이동 직후엔 숨긴 채 유지
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('a[href^="#"]')) return;
      lockUntil = performance.now() + JUMP_LOCK;
      if (window.scrollY > header.offsetHeight) setHidden(true);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      setHidden(false);
    };
  }, []);

  return null;
}
