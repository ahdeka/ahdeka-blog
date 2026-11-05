-- =====================================================================
-- 0002_post_number_and_status.sql
-- 1) 공개 URL을 slug → 자동 증가 번호로 변경
-- 2) 공개 상태를 언어별(post_translations) → 글 단위(posts)로 이동
-- =====================================================================
begin;

-- 1. 공개 URL용 번호 (기존 글에도 자동으로 번호가 매겨짐)
alter table public.posts
  add column number bigint generated always as identity;
alter table public.posts
  add constraint posts_number_key unique (number);

-- 2. 글 단위 공개 상태
alter table public.posts
  add column status text not null default 'draft'
    check (status in ('draft', 'published')),
  add column published_at timestamptz,
  add constraint posts_publish_check
    check (status = 'draft' or published_at is not null);

-- 기존 데이터 이관: 한 언어라도 공개였던 글은 공개로, 가장 이른 공개일을 유지
update public.posts p
set status = 'published', published_at = t.first_published
from (
  select post_id, min(published_at) as first_published
  from public.post_translations
  where status = 'published'
  group by post_id
) t
where p.id = t.post_id;

-- 3. 언어별 상태 제거 (정책이 컬럼을 참조하므로 정책부터 삭제)
drop policy "post_translations: public read (published only)" on public.post_translations;
drop index if exists public.post_translations_list_idx;
alter table public.post_translations
  drop column status,
  drop column published_at;

-- 4. 공개 읽기 정책을 글 단위 상태 기준으로 다시 생성
drop policy "posts: public read (not deleted)" on public.posts;

create policy "posts: public read (published)"
  on public.posts for select
  to anon, authenticated
  using (deleted_at is null and status = 'published');

create policy "post_translations: public read (published post)"
  on public.post_translations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.deleted_at is null
        and p.status = 'published'
    )
  );

-- 5. slug 삭제
alter table public.posts drop column slug;

-- 6. 공개 목록 조회용 인덱스 (공개된 글만 대상)
create index posts_public_list_idx
  on public.posts (published_at desc)
  where status = 'published' and deleted_at is null;

commit;