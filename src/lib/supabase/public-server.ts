import 'server-only';
import { createClient } from '@supabase/supabase-js';

// 공개 페이지 전용: 쿠키·세션을 전혀 쓰지 않음 → ISR 캐시가 유지됨
// RLS가 "공개 + 삭제 안 된 글"만 돌려줌
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}