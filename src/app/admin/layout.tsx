import type { Metadata } from 'next';
import '../globals.css';

// 최상위 app/layout.tsx가 없으므로, /admin도 자체 <html>을 가진 루트 레이아웃이 필요
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}