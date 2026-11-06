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

export default function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-8">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <SiteMark title={dict.site.title} />
          <span className="text-[17px] font-bold tracking-[-0.01em]">{dict.site.title}</span>
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
