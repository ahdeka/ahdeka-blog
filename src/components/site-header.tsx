import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import LocaleSwitcher from './locale-switcher';

// 모양은 디자인 단계에서 다듬을 예정. 지금은 구조와 동작만
export default function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
      <Link href={`/${locale}`} className="font-bold">
        {dict.site.title}
      </Link>
      <div className="flex items-center gap-6">
        <nav aria-label={dict.nav.main}>
          <Link href={`/${locale}/posts`} className="text-sm hover:underline">
            {dict.nav.posts}
          </Link>
        </nav>
        <LocaleSwitcher current={locale} label={dict.nav.language} />
      </div>
    </header>
  );
}
