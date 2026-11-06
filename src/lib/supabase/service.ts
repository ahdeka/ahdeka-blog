import 'server-only';
import { createClient } from '@supabase/supabase-js';

// secret key(구 service_role) 클라이언트: RLS를 우회함 → 호출하는 쪽에서 반드시 검증을 끝낸 뒤 사용
// - 'server-only' 덕분에 클라이언트 컴포넌트에서 import하면 빌드가 실패함
// - 환경변수에 NEXT_PUBLIC_ 을 붙이지 않으므로 브라우저 번들에 들어가지 않음
// 용도: 익명 댓글 작성·삭제 (comment_secrets 는 정책이 없어 이 키로만 접근 가능)
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
