'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';

type Item = { href: string; label: string; match: (rest: string) => boolean };

// 현재 위치 표시(aria-current)만 클라이언트에서. 링크 자체는 서버 렌더링과 같음
export default function SiteNav({ locale, label, blog, about }: { locale: Locale; label: string; blog: string; about: string }) {
  const rest = usePathname().split('/').slice(2).join('/');
  const items: Item[] = [
    { href: `/${locale}`, label: blog, match: (r) => r === '' || r.startsWith('posts') || r.startsWith('category') },
    { href: `/${locale}/about`, label: about, match: (r) => r.startsWith('about') },
  ];

  return (
    <nav aria-label={label} className="flex flex-auto flex-wrap gap-0.5">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.match(rest) ? 'page' : undefined} className="navlink">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
