import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// /admin은 여기에 적지 않음: robots.txt는 누구나 읽을 수 있어 "관리자 페이지가 여기 있다"고 알려주는 셈.
// 대신 /admin은 비관리자에게 404 + X-Robots-Tag: noindex로 처리 (proxy.ts)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
