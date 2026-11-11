'use client';

import { useEffect, useRef } from 'react';
import { setViewCount, useViewCount } from '@/lib/view-store';
import { fill } from '@/lib/format';
import { EyeIcon } from './meta-icons';

// 화면에는 눈 아이콘 + 숫자만, label("조회 {n}")은 화면 낭독기용
function ViewNumber({ views, label }: { views: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={fill(label, { n: views })}>
      <EyeIcon />
      <span className="mono" aria-hidden="true">
        {views.toLocaleString('en-US')}
      </span>
    </span>
  );
}

// 글 화면의 조회수: 열릴 때마다 기록 요청 → 응답의 최신 값을 저장소에 넣음
// (같은 글을 24시간 안에 다시 열면 서버가 세지 않고 최신 값만 돌려줌)
// initial은 캐시된 HTML에 들어 있던 값 (최대 하루 늦을 수 있음)
export default function ViewCount({ number, initial, label }: { number: number; initial: number; label: string }) {
  const views = useViewCount(number, initial);
  // 개발 모드(StrictMode)에서 effect가 두 번 실행돼도 이 화면에서는 요청 한 번만
  // (전역이 아닌 ref라서, 다른 화면에 갔다가 다시 들어오면 새로 요청함)
  const requested = useRef<number | null>(null);

  useEffect(() => {
    if (requested.current === number) return;
    requested.current = number;
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { views: number | null } | null) => {
        if (typeof data?.views === 'number') setViewCount(number, data.views);
      })
      .catch(() => {});
  }, [number]);

  return <ViewNumber views={views} label={label} />;
}

// 목록 카드의 조회수: 요청은 보내지 않고, 이 탭에서 본 글이면 저장소의 최신 값으로
export function ListViewCount({ number, initial, label }: { number: number; initial: number; label: string }) {
  return <ViewNumber views={useViewCount(number, initial)} label={label} />;
}
