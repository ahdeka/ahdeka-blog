import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 관리자 화면 전용: 로그인 세션(쿠키)을 실어서 DB에 접근 → RLS가 "관리자"로 판정
// 공개 페이지에서는 쓰지 말 것 (쿠키를 읽으면 ISR 캐시가 깨짐)
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없음. 갱신은 proxy.ts가 담당하므로 무시해도 됨
          }
        },
      },
    },
  );
}