import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase/auth-server';

// 한 요청 안에서 layout과 page가 둘 다 호출해도 DB 조회는 1번만 하도록 cache로 감쌈
export const getAdmin = cache(async () => {
  const supabase = await createAuthServerClient();

  // JWT 서명을 검증한 뒤 클레임을 꺼냄 (쿠키 값을 그대로 믿지 않음)
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || claims.aal !== 'aal2') return null;

  // 최종 판정은 RLS와 똑같은 DB 함수에 맡김 (admins 등록 여부 + aal2)
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || isAdmin !== true) return null;

  return { supabase, userId: claims.sub, email: claims.email };
});

// 관리자가 아니면 404. 레이아웃·페이지·Server Action 모두 맨 앞에서 호출할 것
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}