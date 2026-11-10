import Form from 'next/form';
import type { Locale } from '@/i18n/config';
import { SEARCH_MAX } from '@/lib/search';

export const SearchIcon = ({ size = 17 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

type Props = {
  locale: Locale;
  defaultValue: string;
  labels: { label: string; placeholder: string; submit: string };
};

// 검색 화면 위쪽 입력창. GET 폼이라 JS 없이도 동작하고, next/form이 클라이언트 이동으로 바꿔 줌
// key: 다른 검색어로 이동하면 입력창 값도 새로 맞춤
export default function SearchForm({ locale, defaultValue, labels }: Props) {
  return (
    <Form action={`/${locale}/search`} role="search" className="mb-8">
      <div className="field-box flex items-center gap-2 pr-1.5 pl-3.5">
        <span className="text-fg-3">
          <SearchIcon />
        </span>
        <input
          key={defaultValue}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={labels.placeholder}
          aria-label={labels.label}
          maxLength={SEARCH_MAX}
          autoFocus={defaultValue === ''}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
        />
        <button type="submit" className="h-8 shrink-0 rounded-lg bg-fg px-3.5 text-[13px] font-semibold text-bg">
          {labels.submit}
        </button>
      </div>
    </Form>
  );
}
