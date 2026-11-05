// 사이트 절대 URL (sitemap, robots, metadataBase 공용)
// Vercel에서는 NEXT_PUBLIC_SITE_URL을 실제 도메인으로 설정할 것 (끝에 / 없이)
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
