import { createClient } from '@supabase/supabase-js';

/**
 * 공개 페이지 전용 클라이언트.
 * 쿠키·로그인 세션을 일절 사용하지 않는다.
 * → 페이지를 ISR(정적 캐싱)로 만들 수 있어 DB 호출이 최소화된다.
 * 관리자 기능에는 쓰지 말 것 (별도 클라이언트를 만들 예정).
 */
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);