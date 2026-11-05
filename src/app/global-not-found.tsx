import type { Metadata } from 'next';
import Link from 'next/link';
import { notFoundTexts } from '@/i18n/not-found-texts';
import './globals.css';

// 어떤 라우트에도 매칭되지 않는 URL용 404 (예: /foo.php, /ja/foo.png 처럼 [locale] 밖이거나 확장자가 붙은 경로)
// 루트 레이아웃이 [locale]과 admin 두 개라서, 공통 404는 이 파일이 담당 (next.config의 globalNotFound)
// 레이아웃을 거치지 않으므로 언어를 알 수 없음 → 두 언어를 함께 표시
// noindex는 404 응답에 Next가 자동으로 넣어줌
export const metadata: Metadata = {
  title: '404',
};

const { ja, ko } = notFoundTexts;

export default function GlobalNotFound() {
  return (
    <html lang="ja">
      <body className="antialiased">
        <main className="mx-auto max-w-3xl px-4 py-24">
          <p className="text-sm text-neutral-500">404</p>
          <h1 className="mt-2 text-2xl font-bold">{ja.title}</h1>
          <p lang="ko" className="mt-1 text-neutral-600 dark:text-neutral-400">
            {ko.title}
          </p>
          <ul className="mt-8 flex gap-6 text-sm">
            <li>
              <Link href="/ja" hrefLang="ja" className="underline underline-offset-4">
                {ja.back}
              </Link>
            </li>
            <li lang="ko">
              <Link href="/ko" hrefLang="ko" className="underline underline-offset-4">
                {ko.back}
              </Link>
            </li>
          </ul>
        </main>
      </body>
    </html>
  );
}
