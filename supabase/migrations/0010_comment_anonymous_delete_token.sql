-- =====================================================================
-- 0010_comment_anonymous_delete_token.sql
-- 댓글 입력 간소화
-- 1) 닉네임 선택 입력: 비우면 빈 문자열로 저장 → 화면에서 언어별 "익명/匿名"으로 표시
-- 2) 비밀번호 제거 → 삭제는 "작성한 브라우저에서, 작성 후 15분 이내"만
--    (작성 시 발급한 1회용 삭제 토큰의 해시만 저장. 시간 제한은 서버 코드에서 created_at 으로 검사)
--
-- ⚠️ 기존 댓글은 삭제 토큰이 없으므로 방문자가 지울 수 없음 (관리자 화면에서는 그대로 삭제 가능)
-- 적용: Dashboard > SQL Editor 에 붙여넣고 Run
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. 닉네임 0~30자 허용 (삭제 묘비 규칙은 그대로)
-- ---------------------------------------------------------------------
alter table public.comments
  drop constraint comments_content_check,
  add constraint comments_content_check check (
    (deleted_at is null
      and char_length(nickname) <= 30
      and char_length(body) between 1 and 2000)
    or (deleted_at is not null and nickname = '' and body = '')
  );

-- ---------------------------------------------------------------------
-- 2. 비밀번호 → 삭제 토큰
--    토큰은 256비트 난수라 느린 해시(scrypt)가 필요 없음 → SHA-256 해시만 저장
--    기존 행에는 토큰이 없으므로 null 허용
-- ---------------------------------------------------------------------
alter table public.comment_secrets
  drop column password_hash,
  drop column failed_attempts,
  drop column locked_until,
  add column delete_token_hash text;
-- 정책은 여전히 없음 (secret key 전용)

commit;
