'use client';

import { useEffect, useState } from 'react';
import { EyeIcon } from './meta-icons';

// 개발 모드(StrictMode)에서 effect가 두 번 실행돼도 요청은 한 번만
const requested = new Set<number>();

// 글 화면의 조회수: 열리면 기록 요청을 보내고, 응답의 최신 값으로 바꿔 보여 줌
// initial은 캐시된 HTML에 들어 있던 값 (최대 하루 늦을 수 있음)
// 화면에는 눈 아이콘 + 숫자만, label("조회 {n}")은 화면 낭독기용
export default function ViewCount({ number, initial, label }: { number: number; initial: number; label: string }) {
  const [views, setViews] = useState(initial);

  useEffect(() => {
    if (requested.has(number)) return;
    requested.add(number);
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { views: number | null } | null) => {
        if (typeof data?.views === 'number') setViews(data.views);
      })
      .catch(() => {});
  }, [number]);

  return (
    <span className="flex items-center gap-1.5" aria-label={label.replace('{n}', String(views))}>
      <EyeIcon />
      <span className="mono" aria-hidden="true">
        {views.toLocaleString('en-US')}
      </span>
    </span>
  );
}
