'use client';

import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';

// 시안의 KO / JA 토글. 화면 낭독기에는 각 언어 이름을 자기 언어로 읽어 줌
const SHORT: Record<Locale, string> = { ko: 'KO', ja: 'JA' };
const FULL: Record<Locale, string> = { ja: '日本語', ko: '한국어' };

// proxy.ts의 LOCALE_COOKIE와 같은 이름. 직접 고른 언어를 다음 방문 때도 우선
const LOCALE_COOKIE = 'NEXT_LOCALE';

export function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

// /ja/posts/3 → /ko/posts/3 (공개 글은 항상 두 언어가 다 있으므로 같은 경로로 이동)
export function swapLocale(pathname: string, locale: Locale) {
  const rest = pathname.split('/').slice(2).join('/');
  return `/${locale}${rest ? `/${rest}` : ''}`;
}

// 표시 순서는 시안대로 KO → JA
const ORDER: Locale[] = ['ko', 'ja'];

export default function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();

  return (
    // 언어 전환은 전체 페이지 이동(<a>): 루트 레이아웃(<html lang>)이 바뀌므로 Link로 하면 테마 스크립트 경고가 남
    <nav aria-label={label} className="flex rounded-[10px] border border-line bg-subtle p-[3px]">
      {ORDER.map((locale) =>
        locale === current ? (
          <span key={locale} aria-current="true" lang={locale} aria-label={FULL[locale]} className="seg">
            {SHORT[locale]}
          </span>
        ) : (
          <a
            key={locale}
            href={swapLocale(pathname, locale)}
            hrefLang={locale}
            lang={locale}
            aria-label={FULL[locale]}
            onClick={() => rememberLocale(locale)}
            className="seg hover:text-fg"
          >
            {SHORT[locale]}
          </a>
        ),
      )}
    </nav>
  );
}
