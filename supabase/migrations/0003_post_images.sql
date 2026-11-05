-- =====================================================================
-- 0003_post_images.sql
-- 게시글 이미지 업로드 정책 강화
--  - 브라우저에서 WebP로 변환한 뒤 올리므로 WebP만 허용
--  - 용량 상한 5MB → 2MB (1600px WebP는 보통 수백 KB)
--  - 업로드 경로를 정해진 형식으로만 허용: {yyyy}/{uuid}_{가로}x{세로}.webp
--    → 관리자 세션이 탈취되더라도 임의 이름·임의 형식 파일을 올릴 수 없음
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

update storage.buckets
set file_size_limit    = 2097152,               -- 2MB
    allowed_mime_types = array['image/webp']
where id = 'post-images';

-- insert / update 정책에 경로 형식 검사를 추가해서 다시 생성
drop policy if exists "post-images: admin insert" on storage.objects;
drop policy if exists "post-images: admin update" on storage.objects;

create policy "post-images: admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and public.is_admin()
    and name ~ '^[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\.webp$'
  );

-- 파일은 덮어쓰지 않는 운영(이름이 매번 새 UUID)이라 update는 사실상 쓰지 않지만,
-- 정책이 있다면 같은 형식 검사를 걸어 둠
create policy "post-images: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'post-images' and public.is_admin())
  with check (
    bucket_id = 'post-images'
    and public.is_admin()
    and name ~ '^[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\.webp$'
  );

-- select / delete 정책은 0001 그대로 (관리자만)
-- public 버킷이라 공개 URL로는 누구나 볼 수 있지만, 파일 "목록" 조회는 관리자만 가능

commit;
