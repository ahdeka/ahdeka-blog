import { createBrowserClient } from '@supabase/ssr';

// 클라이언트 컴포넌트(로그인 화면)에서만 사용. publishable key라 노출되어도 괜찮음
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}