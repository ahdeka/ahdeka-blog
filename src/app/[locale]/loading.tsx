// 페이지 이동 중 스켈레톤. 화면 모양은 도착할 주소를 보고 고름 (components/route-skeleton.tsx)
// loading.tsx는 "그 폴더 바로 아래 칸이 바뀌는 이동"에만 적용됨. 그래서 같은 내용의 파일을 단계마다 둠
//   여기([locale])       : 홈 ↔ 글 ↔ 카테고리 ↔ 태그 ↔ 검색 ↔ 소개
//   category/, tag/      : 카테고리 A → B, 태그 A → B
//   category/[slug]/ 등  : 1페이지 → 2페이지 / page/ : 2페이지 → 3페이지
//   posts/               : 글 → 이전·다음 글
//   search/              : 다른 검색어 (?q= 가 바뀜)
// 미리 받아 둔(prefetch) 페이지는 스켈레톤 없이 바로 넘어감 (globals.css .skel-screen: 150ms 지연 후 표시)
export { default } from '@/components/route-skeleton';
