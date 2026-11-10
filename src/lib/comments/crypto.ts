import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------
// 댓글 삭제 토큰
// - 작성 시 256비트 난수를 발급 → 원본은 작성자 브라우저(localStorage)에만, DB에는 해시만
// - 추측이 불가능한 난수라 비밀번호처럼 느린 해시·솔트가 필요 없음 (SHA-256으로 충분)
// ---------------------------------------------------------------------
export function createDeleteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashDeleteToken(token) };
}

function hashDeleteToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function verifyDeleteToken(token: string, storedHash: string): boolean {
  const actual = Buffer.from(hashDeleteToken(token));
  const expected = Buffer.from(storedHash);
  // 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 비교
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------
// IP 해시 (HMAC-SHA256)
// - 그냥 SHA-256이면 IPv4 전체(약 43억 개)를 대입해 원래 IP를 되돌릴 수 있음
// - 서버만 아는 비밀값을 섞으면 DB가 유출되어도 IP 복원 불가
// ---------------------------------------------------------------------
export function hashIp(ip: string): string {
  const secret = process.env.COMMENT_IP_HASH_SECRET;
  if (!secret || secret.length < 32) throw new Error('COMMENT_IP_HASH_SECRET must be at least 32 chars');
  return createHmac('sha256', secret).update(ip).digest('base64url');
}
