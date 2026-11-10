-- =====================================================================
-- 0009_translation_excerpt.sql
-- 본문 자동 발췌: 요약(summary)을 비워 둔 글은 목록·OG·RSS에 본문 앞부분을 대신 사용
-- - 앱이 저장할 때 Markdown을 걷어낸 160자를 계산해 넣음 (src/lib/excerpt.ts)
-- - 목록 조회 때 본문(content) 전체를 가져오지 않기 위해 따로 저장
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

alter table public.post_translations
  add column excerpt text check (char_length(excerpt) <= 200);

-- 기존 글 채우기: 앱 계산의 간이판 (코드 블록·이미지·링크 문법·기호 제거)
-- 정확한 값은 관리자 화면에서 글을 다시 저장하면 앱 계산으로 덮어씀
update public.post_translations
set excerpt = nullif(left(btrim(regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(content,
    '```.*?```', ' ', 'g'),                      -- 코드 블록
    '~~~.*?~~~', ' ', 'g'),
    '!\[[^]]*\]\([^)]*\)', '', 'g'),             -- 이미지
    '\[([^]]*)\]\([^)]*\)', '\1', 'g'),          -- 링크 → 글자만
    '^[ \t]*(#{1,6}[ \t].*|\|.*)$', '', 'gn'),   -- 제목·표 줄
    '(\*\*|~~|`|^[ \t]*>+|^[ \t]*[-*+][ \t]+)', '', 'gn'),
    '\s+', ' ', 'g')), 160), '')
where excerpt is null;

commit;
