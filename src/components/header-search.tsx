'use client';

import Form from 'next/form';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { SEARCH_MAX } from '@/lib/search';
import { SearchIcon, SearchStatusIcon } from './search-status';

type Props = { locale: Locale; labels: { open: string; placeholder: string } };

// 헤더 검색
// - md 이상: 항상 보이는 입력창 → Enter로 검색 결과 화면 이동
// - 좁은 화면: 헤더가 한 줄 더 늘지 않도록 돋보기 아이콘 → 검색 화면 (그 화면 위쪽에 입력창)
// - 검색 화면에서는 본문 위쪽 입력창과 겹치므로 숨김
export default function HeaderSearch({ locale, labels }: Props) {
  const pathname = usePathname();
  if (pathname === `/${locale}/search`) return null;

  return (
    <>
      <Form action={`/${locale}/search`} role="search" className="hidden md:block">
        <label className="field-box flex h-10 w-[220px] items-center gap-2 px-3 text-fg-3">
          <SearchStatusIcon size={15} />
          <input
            type="search"
            name="q"
            placeholder={labels.placeholder}
            aria-label={labels.open}
            maxLength={SEARCH_MAX}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
          />
        </label>
      </Form>
      <Link href={`/${locale}/search`} aria-label={labels.open} title={labels.open} className="icon-btn md:hidden">
        <SearchIcon />
      </Link>
    </>
  );
}
