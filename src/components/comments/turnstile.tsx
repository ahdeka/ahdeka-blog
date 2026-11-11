'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// 스크립트는 페이지당 1번만 불러옴 (답글 폼을 여러 번 열어도 재다운로드 없음)
// 이 컴포넌트가 처음 그려질 때 불러옴 (CommentForm이 포커스 전까지는 그리지 않음)
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // 다음에 다시 시도할 수 있게
      reject(new Error('turnstile script failed to load'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  action: string;
  language: string;
  onToken: (token: string | null) => void;
  unavailableText: string;
};

// 토큰은 1회용 → 제출할 때마다 부모가 key를 바꿔서 위젯을 새로 만듦
export default function Turnstile({ action, language, onToken, unavailableText }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          language,
          theme: 'auto', // 다크 모드 자동 대응
          size: 'flexible', // 모바일 폭에 맞춰 늘어남
          'refresh-expired': 'auto',
          // 평소에는 보이지 않고, Cloudflare가 의심스럽다고 판단할 때만 체크 화면을 띄움
          appearance: 'interaction-only',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          // code 예: 110200 = 이 사이트 키에 등록되지 않은 도메인, 400020 = 잘못된 사이트 키
          'error-callback': (code: string) => {
            console.warn('[turnstile] widget error', code);
            onTokenRef.current(null);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action, language]);

  if (!siteKey || failed) {
    return <p className="text-xs text-red-600 dark:text-red-400">{unavailableText}</p>;
  }
  // interaction-only라 평소엔 빈 상자. 높이를 미리 잡지 않음 (체크가 필요할 때만 늘어남)
  return <div ref={containerRef} />;
}
