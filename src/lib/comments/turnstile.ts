import 'server-only';
import { SITE_URL } from '@/lib/site';

export const TURNSTILE_ACTION = 'comment';

// Cloudflare 공식 테스트용 secret (1x… 항상 통과 / 2x… 항상 실패 / 3x… 이미 사용된 토큰)
// 테스트 secret은 응답 hostname이 항상 example.com이고 action이 없어서 아래 검사를 할 수 없음
const isTestSecret = (secret: string) => /^[123]x0{30,}AA$/.test(secret);

type SiteverifyResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

// 브라우저 위젯이 발급한 토큰을 Cloudflare에 확인 (토큰은 1회용, 약 5분 유효)
export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) return false;

  const testKey = isTestSecret(secret);
  // 운영 배포에 테스트 키가 들어가면 캡차가 무력화되므로 거부 (fail closed)
  if (testKey && process.env.VERCEL_ENV === 'production') {
    console.error('[turnstile] test secret key is configured in production');
    return false;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error('[turnstile] siteverify http', res.status);
      return false;
    }
    const data = (await res.json()) as SiteverifyResponse;
    // 거부 사유는 Vercel Logs에서 "[turnstile]"로 확인 (키·토큰 값은 남기지 않음)
    // 자주 보는 error-codes: invalid-input-secret(비밀 키 오타·다른 위젯의 키), invalid-input-response(사이트 키와 비밀 키가 다른 위젯), timeout-or-duplicate(만료·재사용)
    if (!data.success) {
      console.error('[turnstile] rejected', data['error-codes']);
      return false;
    }
    if (testKey) return true;

    // 다른 사이트에서 발급받은 토큰이나, 다른 용도(action)의 토큰을 재사용하는 것을 막음
    const expectedHost = new URL(SITE_URL).hostname;
    if (data.action !== TURNSTILE_ACTION) {
      console.error('[turnstile] action mismatch', data.action);
      return false;
    }
    if (process.env.VERCEL_ENV === 'production' && data.hostname !== expectedHost) {
      console.error('[turnstile] hostname mismatch', { got: data.hostname, expected: expectedHost });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[turnstile] siteverify failed', err);
    return false;
  }
}
