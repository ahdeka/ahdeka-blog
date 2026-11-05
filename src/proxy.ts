import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';

const LOCALE_COOKIE = 'NEXT_LOCALE';

function detectLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isLocale(cookie)) return cookie;

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
  return defaultLocale;
}

function isAdminPath(pathname: string) {
  // '/administrator' 같은 경로가 걸리지 않도록 정확히 비교
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

// /admin 전용: 로그인 세션 갱신 + 1차 문지기
async function handleAdmin(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ⚠️ createServerClient와 getClaims 사이에 다른 코드를 넣지 말 것 (Supabase 공식 주의사항)
  const { data } = await supabase.auth.getClaims();
  const isMfaSession = data?.claims?.aal === 'aal2';

  // 관리자 화면은 절대 캐시·색인되지 않게
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  // 로그인 화면만 예외로 통과
  if (request.nextUrl.pathname === '/admin/login') return response;

  // MFA까지 통과한 세션이 아니면 존재 자체를 숨김
  if (!isMfaSession) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) return handleAdmin(request);

  // 공개 페이지는 Supabase 세션을 건드리지 않음 (쿠키를 안 읽어야 캐시가 유지됨)
  const firstSegment = pathname.split('/')[1];
  if (isLocale(firstSegment)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${detectLocale(request)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // api, Next.js 내부 파일, 확장자가 있는 파일은 제외 (admin은 이제 포함)
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};