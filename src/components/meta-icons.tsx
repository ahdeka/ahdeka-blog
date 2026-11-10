// 글 메타 정보(작성일·조회수·댓글 수) 아이콘. 목록과 상세가 같은 모양을 쓰도록 한 곳에 모음
// 모두 장식용(aria-hidden) → 의미는 감싸는 요소의 aria-label이나 <time>이 전달

const base = {
  'aria-hidden': true,
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const ClockIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const EyeIcon = () => (
  <svg {...base}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// 사각 말풍선. 목록(14px)과 댓글 영역 제목(24px)이 같은 모양
export const CommentIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
  </svg>
);
