'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

// 각 언어는 자기 언어로 표기 (일본어 사용자도 '한국어'를, 한국어 사용자도 '日本語'를 바로 알아봄)
const LABELS: Record<Locale, string> = { ja: '日本語', ko: '한국어' };

// proxy.ts의 LOCALE_COOKIE와 같은 이름. 직접 고른 언어를 다음 방문 때도 우선
const LOCALE_COOKIE = 'NEXT_LOCALE';

function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export default function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();

  // /ja/posts/3 → /ko/posts/3 (공개 글은 항상 두 언어가 다 있으므로 같은 경로로 이동)
  const hrefFor = (locale: Locale) => {
    const rest = pathname.split('/').slice(2).join('/');
    return `/${locale}${rest ? `/${rest}` : ''}`;
  };

  return (
    <nav aria-label={label}>
      <ul className="flex gap-3 text-sm">
        {locales.map((locale) =>
          locale === current ? (
            <li key={locale}>
              <span aria-current="true" className="font-semibold">
                {LABELS[locale]}
              </span>
            </li>
          ) : (
            <li key={locale}>
              <Link
                href={hrefFor(locale)}
                hrefLang={locale}
                lang={locale}
                onClick={() => rememberLocale(locale)}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {LABELS[locale]}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
