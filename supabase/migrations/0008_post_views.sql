-- =====================================================================
-- 0008_post_views.sql
-- 조회수 (누적) + 인기글 TOP5
-- - posts에 컬럼을 두지 않고 별도 테이블: posts에는 updated_at 자동 갱신 트리거가 있어서
--   조회될 때마다 "수정일"이 바뀌어 버림 (sitemap lastModified 등이 틀어짐)
-- - 글 하나당 행 1개 (방문 기록은 남기지 않음). 중복 방지는 앱의 쿠키(24시간)로
-- - 증가는 서버(secret key)만 호출 가능한 함수로 → 누구나 직접 RPC로 올리는 것 차단
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

create table public.post_stats (
  post_id    uuid primary key references public.posts (id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0)
);

-- TOP5: 조회수 내림차순
create index post_stats_view_count_idx on public.post_stats (view_count desc);

alter table public.post_stats enable row level security;

-- 읽기: 볼 수 있는 글(공개 글, 관리자는 전부)의 조회수만
-- (서브쿼리에도 posts의 RLS가 적용됨)
create policy "post_stats: read with post"
  on public.post_stats for select
  to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
-- 쓰기 정책 없음 → 아래 함수(secret key)로만 변경

-- 공개 글이면 조회수 +1 후 새 값을 반환, 아니면 null
create or replace function public.increment_post_view(p_number bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_count bigint;
begin
  select id into v_id from public.posts where number = p_number and status = 'published';
  if v_id is null then
    return null;
  end if;

  insert into public.post_stats (post_id, view_count) values (v_id, 1)
  on conflict (post_id) do update set view_count = public.post_stats.view_count + 1
  returning view_count into v_count;
  return v_count;
end;
$$;

-- Supabase는 새 함수에 anon/authenticated 실행 권한을 기본으로 줌 → 명시적으로 회수
revoke execute on function public.increment_post_view(bigint) from public, anon, authenticated;
grant execute on function public.increment_post_view(bigint) to service_role;

commit;
