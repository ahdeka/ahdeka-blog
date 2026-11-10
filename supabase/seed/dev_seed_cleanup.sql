-- =====================================================================
-- ⚠️ DEV 전용. dev_seed_posts.sql로 넣은 시드 데이터를 지움
-- 대상: 한국어 번역의 source_hash = 'seed' 인 글 (번역·태그 연결·댓글·조회수는 on delete cascade)
-- 시드가 새로 만든 태그 10개는 남은 글이 하나도 없을 때만 지움 (기존 Spring·JPA는 건드리지 않음)
-- 이미지 파일은 시드에 없으므로 Storage 정리 불필요
-- =====================================================================
begin;

delete from public.posts
where id in (
  select post_id from public.post_translations
  where locale = 'ko' and source_hash = 'seed'
);

delete from public.tags t
where t.slug in ('java', 'react', 'nextjs', 'postgresql', 'docker', 'typescript', 'git', 'aws', 'kotlin', 'linux')
  and not exists (select 1 from public.post_tags pt where pt.tag_id = t.id);

commit;

-- 확인: 0이면 정리 완료
select count(*) as remaining_seed_posts
from public.post_translations
where locale = 'ko' and source_hash = 'seed';
