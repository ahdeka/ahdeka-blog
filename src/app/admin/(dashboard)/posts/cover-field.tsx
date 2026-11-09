'use client';

import { imagePathFromUrl, imageUrl } from '@/lib/images/paths';

type Props = {
  images: string[]; // 원문(KO) 본문의 이미지 URL (등장 순서)
  value: string | null; // 고른 커버의 Storage 경로
  onChange: (path: string | null) => void;
};

// 커버 이미지: 원문 본문에 올린 이미지 중에서 고름 → 목록 썸네일 + SNS 공유 이미지
export default function CoverField({ images, value, onChange }: Props) {
  // 이 블로그에 올린 이미지만 (외부 이미지 URL은 커버로 쓰지 않음), 같은 이미지는 한 번만
  const paths = [...new Set(images.map(imagePathFromUrl).filter((p): p is string => p !== null))];
  const missing = value !== null && !paths.includes(value);

  return (
    <div className="flex flex-col gap-2">
      <span className="lbl">
        커버 이미지 <span className="font-normal text-fg-3">· 목록 썸네일과 SNS 공유에 쓰여요</span>
      </span>

      {missing && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn">
          <span className="flex-1">고른 커버 이미지가 한국어 본문에서 빠졌어요.</span>
          <button type="button" className="font-semibold underline" onClick={() => onChange(null)}>
            커버 해제
          </button>
        </p>
      )}

      {paths.length === 0 ? (
        <p className="text-[13px] text-fg-3">한국어 본문에 이미지를 올리면 여기서 고를 수 있어요.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          <li>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-pressed={value === null}
              className={`grid h-16 w-24 place-items-center rounded-lg border-2 text-[12.5px] font-semibold ${value === null ? 'border-accent text-fg' : 'border-line text-fg-3'}`}
            >
              없음
            </button>
          </li>
          {paths.map((path, i) => {
            const on = value === path;
            return (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => onChange(path)}
                  aria-pressed={on}
                  aria-label={`본문 ${i + 1}번째 이미지를 커버로`}
                  className={`relative block overflow-hidden rounded-lg border-2 ${on ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(path)} alt="" className="h-16 w-24 object-cover" />
                  <span className="mono absolute top-1 left-1 rounded bg-bg/90 px-1 text-[11px] font-semibold">
                    {i + 1}
                    {on && ' ✓'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
