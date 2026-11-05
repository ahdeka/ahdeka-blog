import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';

const LOCALE_COOKIE = 'NEXT_LOCALE';

function detectLocale(request: NextRequest): Locale {
  // 1순위: 사용자가 언어 전환 버튼으로 직접 고른 언어 (쿠키)
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isLocale(cookie)) return cookie;

  // 2순위: 브라우저 언어 설정 (예: "ko-KR,ko;q=0.9,ja;q=0.8")
  const header = request.headers.get('accept-language') ?? '';
  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of candidates) {
    if (isLocale(lang)) return lang;
  }

  // 3순위: 기본값 (검색엔진 봇은 보통 언어 헤더가 없어서 여기로 옴)
  return defaultLocale;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1];

  // 이미 /ja, /ko 로 시작하면 통과
  if (isLocale(firstSegment)) return NextResponse.next();

  // 그 외에는 언어를 붙여서 리다이렉트 (/ → /ja, /about → /ja/about)
  const url = request.nextUrl.clone();
  url.pathname = `/${detectLocale(request)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // api, admin, Next.js 내부 파일, 확장자가 있는 파일(이미지 등)은 제외
  matcher: ['/((?!api|admin|_next|.*\\..*).*)'],
};