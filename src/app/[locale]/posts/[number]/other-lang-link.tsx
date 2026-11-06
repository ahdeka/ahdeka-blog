'use client';

import type { Locale } from '@/i18n/config';
import { rememberLocale } from '@/components/locale-switcher';

// "日本語で読む" / "한국어로 읽기" — 헤더의 언어 전환과 같이 선택한 언어를 기억
export default function OtherLangLink({ locale, href, label }: { locale: Locale; href: string; label: string }) {
  return (
    // 헤더의 언어 전환과 같은 이유로 전체 페이지 이동(<a>)
    <a
      href={href}
      hrefLang={locale}
      lang={locale}
      onClick={() => rememberLocale(locale)}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-subtle px-3.5 text-[13.5px] font-medium text-fg-2 hover:text-fg"
    >
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
      </svg>
      {label}
    </a>
  );
}
