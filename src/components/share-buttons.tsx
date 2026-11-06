'use client';

import CopyButton from './copy-button';

type Props = { title: string; copyLabel: string; copiedLabel: string; shareXLabel: string };

// URL 복사 + X 공유. 주소는 클릭 시점의 현재 페이지 (ISR 캐시와 무관)
export default function ShareButtons({ title, copyLabel, copiedLabel, shareXLabel }: Props) {
  function shareX() {
    const url = new URL('https://x.com/intent/post');
    url.searchParams.set('text', title);
    url.searchParams.set('url', window.location.href.split('#')[0]);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mt-7 flex justify-end gap-2 border-t border-line pt-6">
      <CopyButton label="URL" doneLabel={copiedLabel} ariaLabel={copyLabel} className="icon-btn mono flex w-auto gap-2 px-3.5 text-[13px] font-medium">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      </CopyButton>
      <button type="button" onClick={shareX} aria-label={shareXLabel} title={shareXLabel} className="icon-btn">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4l16 16M20 4 4 20" />
        </svg>
      </button>
    </div>
  );
}
