import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import LocaleSwitcher from './locale-switcher';
import SiteNav from './site-nav';
import ThemeToggle from './theme-toggle';
import HeaderSearch from './header-search';
import { BRAND, MARK_GLYPH } from '@/lib/brand';

// 파비콘(src/app/icon.svg)과 같은 마크
// 다크 테마에서는 배경에 묻히지 않도록 흰 테두리 (탭 파비콘도 브라우저가 다크일 때 흰 테두리)
export function SiteMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-[30px] shrink-0 rounded-lg dark:ring-[1.5px] dark:ring-white" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill={BRAND.bg} />
      <path d={MARK_GLYPH} fill={BRAND.fg} />
      <rect x="18" y="19" width="8" height="2.8" rx="0.6" fill={BRAND.accent} />
    </svg>
  );
}

// "ahdeka.log" → "ahdeka" + accent 색 ".log" (마지막 점부터 강조, 점이 없으면 그대로)
function SiteWordmark({ title }: { title: string }) {
  const dot = title.lastIndexOf('.');
  return (
    <span className="mono text-[17px] font-bold tracking-[-0.02em]">
      {dot > 0 ? (
        <>
          {title.slice(0, dot)}
          <span className="text-accent-fg">{title.slice(dot)}</span>
        </>
      ) : (
        title
      )}
    </span>
  );
}

export default function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    // 스크롤 따라 숨김/표시: header-auto-hide.tsx + globals.css(.site-header)
    <header className="site-header border-b border-line bg-bg">
      <div className="mx-auto flex min-h-[72px] max-w-[1120px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <SiteMark />
          <SiteWordmark title={dict.site.title} />
        </Link>
        <SiteNav locale={locale} label={dict.nav.main} blog={dict.nav.blog} about={dict.nav.about} />
        <div className="flex items-center gap-2.5">
          <HeaderSearch locale={locale} labels={{ open: dict.search.open, placeholder: dict.search.placeholder }} />
          <LocaleSwitcher current={locale} label={dict.nav.language} />
          <ThemeToggle label={dict.nav.theme} />
        </div>
      </div>
    </header>
  );
}
