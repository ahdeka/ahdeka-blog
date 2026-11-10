'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Labels = { share: string; close: string; copyLink: string; copyBtn: string; copied: string };
type Props = { title: string; labels: Labels };

// 공유 아이콘 1개 → 모달(X · LINE · 링크 복사). 주소는 연 시점의 현재 페이지 (ISR 캐시와 무관)
export default function ShareButtons({ title, labels }: Props) {
  const [url, setUrl] = useState<string | null>(null); // null = 닫힘
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = url !== null;

  const close = useCallback(() => {
    setUrl(null);
    setCopied(false);
    triggerRef.current?.focus(); // 키보드 사용자는 원래 위치로
  }, []);

  // 열려 있는 동안: ESC로 닫기 + 배경 스크롤 잠금 + 닫기 버튼에 포커스
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  function openWindow(target: string) {
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  function shareX() {
    const u = new URL('https://x.com/intent/post');
    u.searchParams.set('text', title);
    u.searchParams.set('url', url!);
    openWindow(u.toString());
  }

  function shareLine() {
    openWindow(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url!)}`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 환경(http 등)에서는 직접 복사하도록
      window.prompt(labels.copyLink, url!);
    }
  }

  return (
    <div className="mt-7 flex justify-end border-t border-line pt-6">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setUrl(window.location.href.split('#')[0])}
        aria-label={labels.share}
        title={labels.share}
        aria-haspopup="dialog"
        className="icon-btn"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>

      {open && (
        // 배경 클릭 시 닫힘
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-line bg-bg p-5 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="share-title" className="text-base font-bold">
                {labels.share}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={labels.close}
                className="grid size-8 place-items-center rounded-full text-fg-3 hover:bg-subtle hover:text-fg"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center gap-7">
              <Target label="X" onClick={shareX}>
                <span className="grid size-12 place-items-center rounded-full bg-black text-white ring-1 ring-line">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </span>
              </Target>
              <Target label="LINE" onClick={shareLine}>
                <span className="grid size-12 place-items-center rounded-full bg-[#06C755] text-white">
                  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.02 3.55 7.39 8.35 8.03.32.07.77.21.88.49.1.25.06.64.03.9l-.14.86c-.04.25-.2.99.87.54 1.07-.45 5.77-3.4 7.87-5.82C21.29 13.5 22 11.9 22 10.13 22 5.64 17.52 2 12 2zM8.13 12.6H6.16a.52.52 0 0 1-.52-.52V8.14a.52.52 0 0 1 1.04 0v3.42h1.45a.52.52 0 0 1 0 1.04zm2.04-.52a.52.52 0 0 1-1.04 0V8.14a.52.52 0 0 1 1.04 0v3.94zm4.7 0a.52.52 0 0 1-.36.5.53.53 0 0 1-.58-.19l-2.02-2.75v2.44a.52.52 0 0 1-1.04 0V8.14a.52.52 0 0 1 .93-.31l2.03 2.76V8.14a.52.52 0 0 1 1.04 0v3.94zm3.24-2.5a.52.52 0 0 1 0 1.04h-1.45v.94h1.45a.52.52 0 0 1 0 1.04h-1.97a.52.52 0 0 1-.52-.52V8.14a.52.52 0 0 1 .52-.52h1.97a.52.52 0 0 1 0 1.04h-1.45v.92z" />
                  </svg>
                </span>
              </Target>
              <Target label={copied ? labels.copied : labels.copyLink} onClick={copyLink}>
                <span className="grid size-12 place-items-center rounded-full bg-subtle text-fg-2 ring-1 ring-line">
                  {copied ? (
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-fg">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                    </svg>
                  )}
                </span>
              </Target>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-subtle p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={url}
                aria-label="URL"
                onFocus={(e) => e.currentTarget.select()}
                className="mono min-w-0 flex-1 bg-transparent text-[13px] text-fg-2 outline-none"
              />
              <button type="button" onClick={copyLink} className="btn btn-primary h-8 shrink-0 rounded-lg px-3.5 text-[13px]">
                <span aria-live="polite">{copied ? labels.copied : labels.copyBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Target({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-16 flex-col items-center gap-1.5 transition-opacity hover:opacity-85">
      {children}
      <span className="text-xs text-fg-2">{label}</span>
    </button>
  );
}
