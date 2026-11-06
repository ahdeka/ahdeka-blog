// 댓글 입력 규칙: 서버(검증)와 클라이언트(입력 제한·안내)가 같은 값을 쓰도록 한 곳에 모음
// DB 제약(0004)과도 맞춰 둘 것
export const NICKNAME_MAX = 30;
export const BODY_MAX = 2000;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 72;
export const MAX_LINKS = 3; // 링크가 많은 댓글은 대부분 스팸

// 제어 문자, 폭 0 문자, 텍스트 방향 조작 문자(닉네임 위장에 쓰임) 제거
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export function cleanNickname(raw: unknown): string {
  return String(raw ?? '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().normalize('NFC');
}

// 줄바꿈은 살리되, 4줄 이상 빈 줄은 3줄로 줄임
export function cleanBody(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .normalize('NFC');
}

export type CommentErrorCode =
  | 'invalid' // 입력값이 규칙에 맞지 않음
  | 'reserved_nickname' // 작성자 닉네임 사칭
  | 'too_many_links'
  | 'captcha' // Turnstile 검증 실패
  | 'rate_limited'
  | 'wrong_password'
  | 'locked' // 비밀번호 연속 실패로 잠김
  | 'not_found'
  | 'server';

export type CommentActionResult = { ok: true } | { ok: false; code: CommentErrorCode };
