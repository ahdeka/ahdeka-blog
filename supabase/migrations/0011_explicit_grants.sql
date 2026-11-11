-- =====================================================================
-- 0011: 테이블·함수 권한을 명시적으로 부여
--
-- 배경: 2026년 이후 새로 만든 Supabase 프로젝트는 public 스키마의 새 테이블에
--       anon / authenticated / service_role 권한을 자동으로 주지 않음
--       (예전 프로젝트인 dev는 자동 부여 → 0001~0010에 GRANT가 없어도 동작했음)
--       prod에서 "permission denied for table categories" (42501)로 빌드 실패
--
-- 원칙: 모든 테이블은 RLS가 켜져 있음. GRANT는 "이 역할이 이 테이블에 접근 시도 가능"까지만,
--       실제로 어떤 행을 읽고 쓰는지는 RLS 정책이 결정
--   - anon          : 공개 화면 읽기 전용 (댓글 등록·조회수 증가는 서버가 service_role로 처리)
--   - authenticated : 관리자 화면 (RLS의 is_admin()으로 관리자만 통과)
--   - service_role  : 서버 전용 비밀 키 (RLS 우회)
--
-- ⚠️ 앞으로 새 테이블을 만드는 마이그레이션에는 그 테이블의 GRANT도 함께 넣을 것
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run (prod·dev 모두. dev에서는 대부분 이미 있는 권한이라 변화 없음)
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

-- 1. anon: 공개 화면에서 읽는 테이블만
grant select on
  public.categories,
  public.posts,
  public.post_translations,
  public.comments,
  public.tags,
  public.post_tags,
  public.post_stats
to anon;

-- 2. authenticated: 관리자 화면 (행 단위 허용은 RLS)
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 3. service_role: 서버 전용
grant all on all tables in schema public to service_role;

-- identity 컬럼(posts.number 등)의 시퀀스
grant usage, select on all sequences in schema public to authenticated, service_role;

-- 4. RLS 정책 안에서 호출되는 함수 (권한이 없으면 정책 평가 자체가 실패)
grant execute on function public.is_admin() to anon, authenticated, service_role;
