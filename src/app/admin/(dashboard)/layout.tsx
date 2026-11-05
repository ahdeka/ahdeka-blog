import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { signOut } from '../actions';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <Link href="/admin" className="font-semibold tracking-tight">ahdeka admin</Link>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
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