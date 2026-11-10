import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import LocaleSwitcher from './locale-switcher';
import SiteNav from './site-nav';
import ThemeToggle from './theme-toggle';

export function SiteMark({ title }: { title: string }) {
  return (
    <span className="mono grid size-[30px] place-items-center rounded-lg bg-fg text-sm font-bold text-bg" aria-hidden="true">
      {title.charAt(0).toUpperCase()}
    </span>
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
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-8">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <SiteMark title={dict.site.title} />
          <SiteWordmark title={dict.site.title} />
        </Link>
        <SiteNav locale={locale} label={dict.nav.main} blog={dict.nav.blog} about={dict.nav.about} />
        <div className="flex items-center gap-2.5">
          <LocaleSwitcher current={locale} label={dict.nav.language} />
          <ThemeToggle label={dict.nav.theme} />
        </div>
      </div>
    </header>
  );
}
