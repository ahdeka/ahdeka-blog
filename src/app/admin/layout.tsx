import type { Metadata } from 'next';
import ThemeScript from '@/components/theme-script';
import { fontVariables } from '../fonts';
import '../globals.css';

// 최상위 app/layout.tsx가 없으므로, /admin도 자체 <html>을 가진 루트 레이아웃이 필요
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 공개 페이지에서 고른 테마(다크/라이트)를 관리자 화면에도 그대로 적용
    <html lang="ko" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
