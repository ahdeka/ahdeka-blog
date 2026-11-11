import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { GITHUB_URL } from '@/lib/site';

export default function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-4 py-7 text-[13px] text-fg-3 sm:px-6">
        <span>© {new Date().getFullYear()} {dict.site.title}</span>
        <span className="flex gap-5">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
            GitHub
          </a>
          <a href={`/${locale}/rss.xml`} className="hover:text-fg">
            RSS
          </a>
          <Link href={`/${locale}/about`} className="hover:text-fg">
            {dict.footer.about}
          </Link>
        </span>
      </div>
    </footer>
  );
}
