import { cookies, headers } from 'next/headers';
import { getAdmin } from '@/lib/auth/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { getViewCount } from '@/lib/views';

// 조회수 기록: 글 화면이 열리면 클라이언트(ViewCount)가 POST { number }
// - 같은 브라우저에서 같은 글은 24시간 동안 다시 세지 않음 (쿠키)
// - 관리자·봇은 세지 않음
// - 응답으로 최신 조회수를 돌려줌 (글 페이지는 캐시된 HTML이라 숫자가 늦을 수 있음)
// Server Action이 아니라 Route Handler인 이유: Server Action에서 쿠키를 설정하면
// Next가 현재 페이지를 서버에서 다시 렌더링함 → 조회 한 번마다 글 페이지를 다시 그리는 낭비

const COOKIE = 'pv';
const WINDOW_SEC = 24 * 60 * 60;
const MAX_ENTRIES = 100; // 쿠키 크기 제한 (4KB) 안에서 충분
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|java\//i;

// 쿠키 값: "12.1731200000-13.1731203600" (글 번호.만료시각초)
function parseSeen(raw: string | undefined, now: number): Map<number, number> {
  const seen = new Map<number, number>();
  for (const part of (raw ?? '').split('-')) {
    const [n, exp] = part.split('.').map(Number);
    if (Number.isSafeInteger(n) && Number.isSafeInteger(exp) && exp > now) seen.set(n, exp);
  }
  return seen;
}

const json = (views: number | null, status = 200) =>
  Response.json({ views }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: Request) {
  // 다른 사이트에서 보낸 요청 차단 (브라우저는 POST에 Origin을 붙임)
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(null, 403);

  const body = (await request.json().catch(() => null)) as { number?: unknown } | null;
  const number = body?.number;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1) return json(null, 400);

  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  const cookieStore = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const seen = parseSeen(cookieStore.get(COOKIE)?.value, now);

  // 세지 않는 경우: 이미 봄 / 봇 / 관리자 (관리자 확인은 로그인 쿠키가 있을 때만 → 일반 방문자는 DB 조회 없음)
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith('sb-'));
  if (seen.has(number) || !ua || BOT_UA.test(ua) || (hasAuthCookie && (await getAdmin()))) {
    return json(await getViewCount(number));
  }

  const { data, error } = await createServiceClient().rpc('increment_post_view', { p_number: number });
  if (error) {
    console.error('[views] increment failed', error);
    return json(await getViewCount(number));
  }
  if (data === null) return json(null, 404); // 공개 글이 아님

  seen.set(number, now + WINDOW_SEC);
  const value = [...seen]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ENTRIES)
    .map(([n, exp]) => `${n}.${exp}`)
    .join('-');
  cookieStore.set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WINDOW_SEC,
  });
  return json(Number(data));
}
