-- =====================================================================
-- 0006_translation_source_hash.sql
-- 번역본이 어떤 원문(KO)을 기준으로 번역됐는지 기록
--  - source_hash: 번역 결과를 붙여넣을 때(또는 "반영 완료"로 표시할 때) 원문의 해시
--  - 에디터가 지금 원문의 해시와 비교해서 다르면 "원문 변경됨"을 표시
--  - 원문(KO) 행과, 아직 기준이 기록되지 않은 번역본은 null
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
alter table public.post_translations
  add column source_hash text check (source_hash ~ '^[0-9a-z]{1,32}$');
