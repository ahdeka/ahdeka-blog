'use client';

import { useLinkStatus } from 'next/link';

// <Link> 안 아무 곳에나 넣는 보이지 않는 표시. 클릭 후 다음 화면을 기다리는 동안 data-pending이 붙고,
// globals.css의 a:has(.link-pending[data-pending])가 그 링크를 살짝 흐리게 함
// - 미리 받아 둔(prefetch) 페이지는 바로 넘어가므로 이 상태가 생기지 않음
// - 스켈레톤(loading.tsx)이 뜨기 전 빈틈을 메우는 용도: "눌렸다"는 것만 알려 줌
export default function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className="link-pending" data-pending={pending || undefined} />;
}
