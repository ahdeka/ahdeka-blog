-- =====================================================================
-- 0007_tags_cover_post_images.sql
-- 1) 태그: 글마다 여러 개. 이름은 영문 하나(KO/JA 공통), 주소는 /tag/{slug}
--    - 이름은 대소문자만 다르면 같은 태그 (Spring = spring)
--    - slug는 이름에서 자동 생성하되 직접 바꿀 수 있음 (C# → csharp, C++ → cpp)
--    - 태그를 지우면 글에서도 빠짐 (카테고리와 달리 글이 남아 있어도 삭제 가능)
-- 2) post_images: 업로드한 이미지가 어느 글 소속인지 기록
--    - 업로드 직후에는 post_id = null, 글을 저장하면 그 글 소속이 됨
--    - 본문에서 지운 이미지 / 저장하지 않고 버린 업로드를 버킷에서 정리하는 근거
--    - 기존 이미지는 아래 4번에서 채움 (어느 글에도 안 쓰인 파일은 주인 없음으로 → 다음 저장 때 정리)
-- 3) 커버 이미지: posts.cover_image_path (0001에 이미 있음)를 post_images에 연결
--    - 목록 카드 썸네일 + SNS 공유 이미지(OG)
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. 태그
-- ---------------------------------------------------------------------
create table public.tags (
  id         bigint generated always as identity primary key,
  -- 영문·숫자·공백·. # + - (Node.js, C#, C++, Spring Boot). 앞뒤 공백·연속 공백 금지
  name       text not null check (
    char_length(name) between 1 and 30
    and name ~ '^[A-Za-z0-9 .#+-]+$'
    and name ~ '[A-Za-z0-9]'
    and name = btrim(name)
    and position('  ' in name) = 0
  ),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 50),
  created_at timestamptz not null default now()
);

-- 대소문자만 다른 태그 금지
create unique index tags_name_lower_key on public.tags (lower(name));

alter table public.tags enable row level security;

create policy "tags: public read"
  on public.tags for select
  to anon, authenticated
  using (true);

create policy "tags: admin write"
  on public.tags for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 글 ↔ 태그. position: 에디터에서 넣은 순서대로 보여 주기 위함
create table public.post_tags (
  post_id  uuid   not null references public.posts (id) on delete cascade,
  tag_id   bigint not null references public.tags (id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, tag_id)
);

-- 태그 화면: "이 태그가 붙은 글" 조회용
create index post_tags_tag_id_idx on public.post_tags (tag_id);

alter table public.post_tags enable row level security;

-- 공개된 글의 태그만 보임 → 태그별 글 수도 공개 글만 세어짐
create policy "post_tags: public read (published post)"
  on public.post_tags for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy "post_tags: admin all"
  on public.post_tags for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2. post_images
--    path는 업로드 경로 형식(0003)과 같음. 공개 화면은 이 테이블을 읽지 않으므로 관리자 전용
-- ---------------------------------------------------------------------
create table public.post_images (
  path       text primary key check (
    path ~ '^[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\.webp$'
  ),
  -- 글을 지우면 null(주인 없음)로. 실제 파일 정리는 서버(deletePost)가 함
  post_id    uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index post_images_post_id_idx on public.post_images (post_id);
-- 오래된 주인 없는 업로드 정리용
create index post_images_unowned_idx on public.post_images (created_at) where post_id is null;

alter table public.post_images enable row level security;

create policy "post_images: admin all"
  on public.post_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 3. 기존 이미지 채우기
-- ---------------------------------------------------------------------
-- 3-1) 본문에 쓰인 이미지: 가장 먼저 만든 글이 주인
insert into public.post_images (path, post_id)
select distinct on (m[1]) m[1], t.post_id
from public.post_translations t
join public.posts p on p.id = t.post_id
cross join lateral regexp_matches(
  t.content,
  '/storage/v1/object/public/post-images/([0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\.webp)',
  'g'
) as m
order by m[1], p.created_at
on conflict (path) do nothing;

-- 3-2) 커버로만 쓰인 이미지 (형식이 맞는 것만)
insert into public.post_images (path, post_id)
select cover_image_path, id
from public.posts
where cover_image_path ~ '^[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\.webp$'
on conflict (path) do nothing;

-- 3-3) 버킷에는 있지만 어느 글에도 안 쓰인 파일 → 주인 없음 (업로드 시각 유지)
--      7일 넘은 주인 없는 파일은 다음 글 저장 때 버킷에서 지워짐
insert into public.post_images (path, post_id, created_at)
select o.name, null, coalesce(o.created_at, now())
from storage.objects o
where o.bucket_id = 'post-images'
  and o.name ~ '^[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\.webp$'
on conflict (path) do nothing;


-- ---------------------------------------------------------------------
-- 4. 커버 이미지 → post_images 연결
--    형식이 다른 기존 값은 비움 (지금까지 커버를 고르는 화면이 없었으므로 보통 전부 null)
-- ---------------------------------------------------------------------
update public.posts
set cover_image_path = null
where cover_image_path is not null
  and cover_image_path not in (select path from public.post_images);

alter table public.posts
  add constraint posts_cover_image_path_fkey
    foreign key (cover_image_path) references public.post_images (path) on delete set null;

commit;
