import type { Locale } from '@/i18n/config';

// 사이트 절대 URL (sitemap, robots, metadataBase, RSS, Turnstile 호스트 검사 공용 — 서버 코드에서만 사용)
// - Production: NEXT_PUBLIC_SITE_URL = 실제 도메인 (끝에 / 없이) — 반드시 설정
// - Preview: 설정하지 않으면 Vercel이 넣어 주는 배포 주소(VERCEL_URL) → OG 이미지 등이 그 배포를 가리킴
// - 로컬: localhost
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
).replace(/\/$/, '');

// 블로그 주인 핸들(@ahdeka): 관리자 답글의 닉네임으로 쓰이고, 일반 댓글에서는 사용 금지(사칭 방지)
export const AUTHOR_NAME = 'ahdeka';

// 화면에 보이는 닉네임 (프로필·글 작성자 표시). 일반 댓글에서는 이것도 사용 금지
export const AUTHOR_NICKNAME: Record<Locale, string> = {
  ko: '다미',
  ja: 'ダミ',
};

// 프로필 사진 (public/ 아래, 320×320 WebP, EXIF 제거됨)
export const AUTHOR_AVATAR = '/profile.webp';

// 프로필·푸터 링크
export const GITHUB_URL = 'https://github.com/ahdeka';
export const CONTACT_EMAIL = 'ahdeka01@gmail.com';
