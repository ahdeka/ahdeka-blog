'use client';

import { useFormStatus } from 'react-dom';

export const SearchIcon = ({ size = 17 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

// 검색 입력창 왼쪽 돋보기. 검색을 보낸 뒤 결과 화면이 뜰 때까지는 같은 자리에서 도는 표시로 바뀜
// (검색 화면은 요청마다 DB를 찾으므로 미리 받아 둘 수 없음 → 누른 직후 반응을 여기서 보여 줌)
// useFormStatus: 이 컴포넌트를 감싼 <Form>의 전송 상태
export function SearchStatusIcon({ size = 17 }: { size?: number }) {
  const { pending } = useFormStatus();
  if (!pending) return <SearchIcon size={size} />;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="spin">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
