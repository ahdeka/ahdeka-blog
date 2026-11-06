-- =====================================================================
-- 0005_categories_tree.sql
-- 카테고리 2단계(상위/하위) + 삭제 보호
--  1) parent_id 추가: 상위 카테고리 아래에 하위 카테고리 1단계까지만
--     - 주소는 그대로 /category/{slug} (slug는 전체에서 유일)
--       → 하위 카테고리를 다른 상위로 옮겨도 URL이 바뀌지 않음
--  2) 글이 남아 있거나 하위 카테고리가 있으면 삭제 불가 (on delete restrict)
--     - 기존: on delete set null → 카테고리를 지우면 글이 조용히 "카테고리 없음"이 됨
--  3) 이름 길이 제한 (관리자 화면과 같은 1~50자)
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

-- 1) 상위 카테고리
alter table public.categories
  add column parent_id bigint references public.categories (id) on delete restrict;

create index categories_parent_id_idx on public.categories (parent_id);

-- 2단계를 넘지 않도록 검사 (check 제약은 다른 행을 볼 수 없어서 트리거로)
--  - 자기 자신을 상위로 지정할 수 없음
--  - 상위로 지정한 카테고리는 최상위여야 함 (하위의 하위 금지)
--  - 하위 카테고리를 가진 카테고리는 다른 카테고리 아래로 들어갈 수 없음
create or replace function public.check_category_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'category cannot be its own parent' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
    raise exception 'categories can only be nested one level' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.categories where parent_id = new.id) then
    raise exception 'category with children cannot have a parent' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categories_check_depth
  before insert or update of parent_id on public.categories
  for each row execute function public.check_category_depth();

-- 2) 글이 남은 카테고리 삭제 금지
alter table public.posts
  drop constraint posts_category_id_fkey,
  add constraint posts_category_id_fkey
    foreign key (category_id) references public.categories (id) on delete restrict;

-- 3) 이름 길이
alter table public.categories
  add constraint categories_name_ko_length check (char_length(btrim(name_ko)) between 1 and 50),
  add constraint categories_name_ja_length check (char_length(btrim(name_ja)) between 1 and 50);

commit;
