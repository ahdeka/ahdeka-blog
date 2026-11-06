-- =====================================================================
-- 0004_comments_and_hard_delete.sql
-- 1) 좋아요 기능 제거 (만들지 않기로 결정)
-- 2) 게시글 삭제: 소프트 삭제 → 하드 삭제
--    "숨기기"는 초안(draft)으로 돌리는 것으로 대체
-- 3) 댓글: 1단계 답글, 작성자 배지, 답글이 달린 댓글의 삭제 표시(묘비)
-- 4) 댓글 비밀 정보: rate limit용 작성 시각, 삭제 방식은 비밀번호로 일원화
--
-- ⚠️ 실행 전 확인: 현재 "삭제됨" 상태인 글은 번역·댓글과 함께 영구 삭제됨
--    (본문 이미지 파일은 Storage에 남음. 필요하면 Dashboard > Storage 에서 정리)
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. 좋아요 제거
-- ---------------------------------------------------------------------
drop function if exists public.get_like_count(uuid);
drop table if exists public.likes;


-- ---------------------------------------------------------------------
-- 2. 게시글 하드 삭제 전환
--    deleted_at 을 참조하는 정책·인덱스를 먼저 지우고 컬럼 삭제
-- ---------------------------------------------------------------------
delete from public.posts where deleted_at is not null;   -- 번역·댓글은 on delete cascade

drop policy "posts: public read (published)" on public.posts;
drop policy "post_translations: public read (published post)" on public.post_translations;
drop policy "comments: public read (not deleted)" on public.comments;
drop index if exists public.posts_public_list_idx;

alter table public.posts drop column deleted_at;

create policy "posts: public read (published)"
  on public.posts for select
  to anon, authenticated
  using (status = 'published');

create policy "post_translations: public read (published post)"
  on public.post_translations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create index posts_public_list_idx
  on public.posts (published_at desc)
  where status = 'published';


-- ---------------------------------------------------------------------
-- 3. 댓글
-- ---------------------------------------------------------------------
-- 기존 소프트 삭제 댓글은 정리 (아래 새 제약 조건과 맞지 않으므로)
delete from public.comments where deleted_at is not null;

alter table public.comments
  add column parent_id uuid references public.comments (id) on delete cascade,
  -- 블로그 주인(관리자)이 단 댓글 → "작성자" 배지. 서버만 true 로 쓸 수 있음
  add column is_author boolean not null default false;

-- 삭제 묘비: 답글이 달린 댓글을 본인이 지우면 행은 남기고 닉네임·본문을 비움
--   → 답글의 맥락("삭제된 댓글입니다")은 유지하되, 지운 내용은 DB에 남지 않음
alter table public.comments
  drop constraint comments_nickname_check,
  drop constraint comments_body_check,
  add constraint comments_content_check check (
    (deleted_at is null
      and char_length(nickname) between 1 and 30
      and char_length(body) between 1 and 2000)
    or (deleted_at is not null and nickname = '' and body = '')
  );

create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;

-- 답글 규칙을 DB에서도 강제 (서버 코드에 버그가 있어도 깨지지 않도록)
--   - 부모는 같은 글의 댓글이어야 함
--   - 부모는 최상위 댓글이어야 함 (답글의 답글 금지 = 1단계)
--   - 삭제(묘비)된 댓글에는 새 답글 금지
create or replace function public.check_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;

  select c.post_id, c.parent_id, c.deleted_at
    into parent
    from public.comments c
   where c.id = new.parent_id;

  if not found
     or parent.post_id <> new.post_id
     or parent.parent_id is not null
     or new.parent_id = new.id then
    raise exception 'invalid parent comment' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and parent.deleted_at is not null then
    raise exception 'cannot reply to a deleted comment' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger comments_check_parent
  before insert or update of parent_id, post_id on public.comments
  for each row execute function public.check_comment_parent();

-- 공개 읽기: 공개된 글의 댓글 전부 (묘비 포함 — 내용은 이미 비어 있음)
create policy "comments: public read (published post)"
  on public.comments for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );
-- "comments: admin all" 정책은 0001 그대로 유지
-- anon 용 insert/update/delete 정책은 여전히 없음 (작성·삭제는 서버가 검증 후 secret key 로 처리)


-- ---------------------------------------------------------------------
-- 4. 댓글 비밀 정보
-- ---------------------------------------------------------------------
-- 삭제는 "작성 시 입력한 비밀번호"로만 → localStorage 토큰 방식 제거
alter table public.comment_secrets
  drop column delete_token_hash,
  add column created_at timestamptz not null default now();

-- rate limit: "이 IP 해시가 최근 N분 동안 몇 개 썼는가"를 인덱스로 바로 셈
drop index if exists public.comment_secrets_ip_idx;
create index comment_secrets_ip_time_idx on public.comment_secrets (ip_hash, created_at desc);
-- 정책은 여전히 없음 (secret key 전용)

commit;
