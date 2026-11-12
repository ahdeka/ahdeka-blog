'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  labels: { zoom: string; close: string };
};

// 본문 이미지: 클릭(또는 Enter·Space)하면 화면 가득 크게 보기
// - 확대 화면은 <dialog>(showModal): Esc로 닫힘, 포커스가 안에 갇힘, 닫으면 원래 버튼으로 포커스 복귀
// - <body>로 portal → 문단(<p>) 안의 이미지여도 HTML 구조가 깨지지 않음 (열렸을 때만 그림)
// - 확대 화면 아무 곳이나 클릭하면 닫힘 (닫기 버튼도 있음)
export default function ZoomImage({ src, alt, width, height, labels }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // 뒤쪽 본문이 스크롤되지 않게
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="zoom-trigger"
        aria-label={alt ? `${labels.zoom}: ${alt}` : labels.zoom}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            className="zoom-dialog"
            aria-label={alt || labels.zoom}
            onClose={() => setOpen(false)}
            onClick={() => dialogRef.current?.close()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} width={width} height={height} />
            <button type="button" className="zoom-close" aria-label={labels.close} autoFocus>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </dialog>,
          document.body,
        )}
    </>
  );
}
