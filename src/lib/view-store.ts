'use client';

import { useSyncExternalStore } from 'react';

// 브라우저 안의 "최신 조회수" 저장소 (글 번호 → 조회수)
// 글 화면·목록 카드는 캐시된 HTML(최대 하루 전 값)을 받으므로, 이 탭에서 받아 온 최신 값이 있으면 그걸 보여 줌
// - 글 화면에서 /api/views 응답을 받으면 setViewCount → 같은 탭의 목록 카드도 즉시 같은 값
// - sessionStorage에도 저장 → 새로고침 직후에도 마지막으로 본 값이 바로 보임 (탭을 닫으면 사라짐)
// 조회수는 줄지 않으므로 캐시 값과 저장값 중 큰 쪽을 씀

const KEY = 'view-counts';
const counts = new Map<number, number>();
const listeners = new Set<() => void>();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    for (const [n, v] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) {
      if (typeof v === 'number') counts.set(Number(n), v);
    }
  } catch {}
}

export function setViewCount(number: number, views: number) {
  load();
  if ((counts.get(number) ?? -1) >= views) return;
  counts.set(number, views);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(counts)));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// initial: 캐시된 HTML에 들어 있던 값. 서버 렌더링·하이드레이션 중에는 이 값 → 직후 저장값으로 교체
export function useViewCount(number: number, initial: number): number {
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return counts.get(number) ?? null;
    },
    () => null,
  );
  return Math.max(initial, stored ?? 0);
}
