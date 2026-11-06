import 'server-only';
import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// ---------------------------------------------------------------------
// 댓글 삭제용 비밀번호 해시 (Node 내장 scrypt)
// - bcrypt 패키지 없이 같은 목적(느린 해시 + 솔트)을 달성 → 의존성·콜드 스타트 부담 없음
// - 저장 형식: scrypt$N$r$p$salt$hash  (파라미터를 함께 저장해 두면 나중에 강도를 올려도 기존 해시 검증 가능)
// ---------------------------------------------------------------------
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;

function scryptAsync(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize('NFKC'), salt, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
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
