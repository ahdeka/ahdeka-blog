-- =====================================================================
-- 0001_init.sql
-- 개인 기술 블로그 초기 스키마 + RLS 정책
-- 적용 방법: Supabase Dashboard > SQL Editor 에 전체 붙여넣고 Run
-- 저장소 경로: supabase/migrations/0001_init.sql
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. 공통: updated_at 자동 갱신 트리거 함수
--    (JPA의 @PreUpdate 로 updatedAt 을 갱신하는 것과 같은 역할)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 1. 관리자 판정
--    - admins 테이블에 등록된 계정이면서
--    - MFA(TOTP)까지 통과한 세션(aal2)일 때만 관리자로 인정
--    → 비밀번호가 유출되어도 TOTP 없이는 DB 쓰기 불가
-- ---------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- admins 테이블에는 정책을 하나도 만들지 않음 = anon/authenticated 모두 접근 불가
-- (관리자 등록은 SQL Editor 에서만 수행)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.admins a
      where a.user_id = (select auth.uid())
    )
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;


-- ---------------------------------------------------------------------
-- 2. 카테고리
-- ---------------------------------------------------------------------
create table public.categories (
  id         bigint generated always as identity primary key,
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ja    text not null,
  name_ko    text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories: public read"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "categories: admin write"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 3. 게시글 (언어 공통 정보)
--    URL: /ja/posts/{slug}, /ko/posts/{slug} — slug 는 언어 공통
--    삭제는 소프트 삭제(deleted_at)
-- ---------------------------------------------------------------------
create table public.posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id      bigint references public.categories (id) on delete set null,
  cover_image_path text,                     -- Storage 내 경로 (URL 아님)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

create policy "posts: public read (not deleted)"
  on public.posts for select
  to anon, authenticated
  using (deleted_at is null);

create policy "posts: admin all"
  on public.posts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 4. 게시글 번역 (언어별 본문)
--    - 언어별로 공개 여부를 따로 관리 (ko 먼저 공개, ja 는 다듬은 뒤 공개 가능)
-- ---------------------------------------------------------------------
create table public.post_translations (
  id           bigint generated always as identity primary key,
  post_id      uuid not null references public.posts (id) on delete cascade,
  locale       text not null check (locale in ('ja', 'ko')),
  title        text not null check (char_length(title) between 1 and 200),
  summary      text check (char_length(summary) <= 500),   -- 목록·OGP 설명용
  content      text not null default '',                   -- Markdown
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (post_id, locale),
  -- 공개 상태라면 공개 일시가 반드시 있어야 함
  check (status = 'draft' or published_at is not null)
);

create index post_translations_list_idx
  on public.post_translations (locale, status, published_at desc);

create trigger post_translations_set_updated_at
  before update on public.post_translations
  for each row execute function public.set_updated_at();

alter table public.post_translations enable row level security;

create policy "post_translations: public read (published only)"
  on public.post_translations for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.deleted_at is null
    )
  );

create policy "post_translations: admin all"
  on public.post_translations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 5. 댓글 (공개 정보만)
--    - 작성/삭제는 anon 이 직접 못 함. 서버(Server Action)가 검증 후 service_role 로 처리
--    - 비밀 정보는 이 테이블에 두지 않음 → 6번 comment_secrets 로 분리
-- ---------------------------------------------------------------------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 30),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

create policy "comments: public read (not deleted)"
  on public.comments for select
  to anon, authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.deleted_at is null
    )
  );

create policy "comments: admin all"
  on public.comments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- anon 용 insert/update/delete 정책은 의도적으로 만들지 않음


-- ---------------------------------------------------------------------
-- 6. 댓글 비밀 정보 (별도 테이블)
--    - 정책을 하나도 만들지 않음 → anon/authenticated(관리자 포함) 모두 조회 불가
--    - service_role(서버 전용 키)만 접근 가능 (service_role 은 RLS 를 우회)
--    → "공개 읽기 정책에 해시 컬럼이 딸려 나가는" 실수를 구조적으로 차단
-- ---------------------------------------------------------------------
create table public.comment_secrets (
  comment_id        uuid primary key references public.comments (id) on delete cascade,
  password_hash     text not null,        -- bcrypt
  delete_token_hash text not null,        -- localStorage 토큰의 해시 (같은 브라우저 즉시 삭제용)
  ip_hash           text not null,        -- 나중에 rate limit / IP 차단에 사용
  failed_attempts   int  not null default 0,
  locked_until      timestamptz           -- 비밀번호 5회 실패 시 잠금
);

create index comment_secrets_ip_idx on public.comment_secrets (ip_hash);

alter table public.comment_secrets enable row level security;
-- 정책 없음 (의도적)


-- ---------------------------------------------------------------------
-- 7. 좋아요 (2단계 기능이지만 테이블만 미리 생성)
--    - ip_hash 가 들어있으므로 직접 조회는 막고, 개수만 함수로 공개
-- ---------------------------------------------------------------------
create table public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  ip_hash    text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, ip_hash)          -- 같은 IP 중복 좋아요 DB 레벨 차단
);

alter table public.likes enable row level security;
-- 정책 없음 (쓰기는 서버 경유, 읽기는 아래 함수로 개수만)

create or replace function public.get_like_count(p_post_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.likes where post_id = p_post_id;
$$;

grant execute on function public.get_like_count(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. Storage: 게시글 이미지 버킷
--    - public 버킷: 공개 URL 로 이미지 표시 가능
--    - anon 용 SELECT 정책은 만들지 않음 (만들면 파일 목록 조회가 가능해짐)
--    - 업로드/수정/삭제는 관리자(MFA 통과)만
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,                                            -- 5MB 상한
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do nothing;

create policy "post-images: admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images' and public.is_admin());

create policy "post-images: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'post-images' and public.is_admin())
  with check (bucket_id = 'post-images' and public.is_admin());

create policy "post-images: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and public.is_admin());

-- 관리자 화면에서 업로드한 이미지 목록을 보기 위한 조회 (관리자만)
create policy "post-images: admin select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'post-images' and public.is_admin());


-- =====================================================================
-- [수동 작업] 관리자 등록 — 이 파일 실행 후 한 번만
--   1) Dashboard > Authentication > Users > "Add user" 로 본인 계정 생성
--   2) Authentication > Sign In / Providers 에서 신규 가입(Allow new users) 끄기
--   3) 아래 SQL 의 이메일을 본인 것으로 바꿔서 실행
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'you@example.com';
--
--   4) 로그인 후 TOTP(MFA) 등록 — 등록 전까지는 aal2 가 아니라서 글쓰기가 막힘 (정상)
-- =====================================================================
