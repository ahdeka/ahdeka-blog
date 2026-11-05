'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { defaultLocale, isLocale } from '@/i18n/config';
import { notFoundTexts } from '@/i18n/not-found-texts';

// [locale] 안에서 notFound()가 호출됐을 때 표시 (헤더가 있는 레이아웃 안)
// - /ja/posts/999 처럼 페이지가 직접 호출하는 경우
// - /ja/xyz 처럼 매칭되는 라우트가 없는 경우 ([...rest]/page.tsx가 호출)
// not-found는 params를 받지 못함. headers()를 쓰면 ISR 페이지가 동적 렌더링으로 바뀔 수 있어
// 클라이언트에서 경로로 언어를 판단
export default function LocaleNotFound() {
  const segment = usePathname().split('/')[1] ?? '';
  const locale = isLocale(segment) ? segment : defaultLocale;
  const t = notFoundTexts[locale];

  return (
    <main className="mx-auto max-w-3xl px-4 py-24">
      <p className="text-sm text-neutral-500">404</p>
      <h1 className="mt-2 text-2xl font-bold">{t.title}</h1>
      <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-400">{t.body}</p>
      <Link href={`/${locale}`} className="mt-8 inline-block text-sm underline underline-offset-4">
        {t.back}
      </Link>
    </main>
  );
}
