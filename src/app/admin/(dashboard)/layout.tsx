import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { signOut } from '../actions';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold tracking-tight">ahdeka admin</Link>
          <nav className="flex gap-4 text-sm text-neutral-500">
            <Link href="/admin" className="hover:text-neutral-900 dark:hover:text-neutral-100">글</Link>
            <Link href="/admin/comments" className="hover:text-neutral-900 dark:hover:text-neutral-100">댓글</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          {/* "/"는 proxy가 마지막으로 고른 언어(쿠키)로 보내 줌
              루트 레이아웃이 달라서 Next가 알아서 전체 페이지 이동으로 처리 */}
          <Link href="/" className="flex items-center gap-1 font-medium text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100">
            블로그 보기 →
          </Link>
          <span className="hidden sm:inline">{admin.email}</span>
          <form action={signOut}>
            <button className="hover:text-neutral-900 dark:hover:text-neutral-100">로그아웃</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}