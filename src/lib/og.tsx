import 'server-only';
import { ImageResponse } from 'next/og';
import { BRAND, MARK_SVG } from '@/lib/brand';

// SNS 공유 미리보기 이미지 (1200×630)
// - 기본 카드: 이미지가 없는 모든 페이지 (홈·카테고리·태그·소개)
// - 글 카드: 커버 이미지가 없는 글 (제목·카테고리·날짜)

export const OG_SIZE = { width: 1200, height: 630 } as const;

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`;
// 카드 배경은 마크(BRAND.bg)보다 한 단계 어둡게 + 마크에 옅은 테두리 → 마크의 사각형이 배경에 묻히지 않음
const CARD_BG = '#0B0C0F';

function Mark({ size }: { size: number }) {
  return (
    <div style={{ display: 'flex', borderRadius: (size * 7) / 32 + 2, border: '2px solid #2E323A' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MARK_SRC} width={size} height={size} alt="" />
    </div>
  );
}

type FontWeight = 500 | 600 | 700 | 800;
type FontSpec = { family: string; weight: FontWeight };
type LoadedFont = { name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' };

// Google Fonts에서 카드에 쓰인 글자만 잘라 받음 (한·일 글꼴 전체는 수 MB라 번들에 넣지 않음)
// User-Agent 없이 요청하면 ImageResponse가 읽을 수 있는 TTF로 내려옴
async function loadGoogleFont({ family, weight }: FontSpec, text: string): Promise<LoadedFont> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { cache: 'force-cache' })).text();
  const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
  if (!src) throw new Error(`OG font not found: ${family} ${weight}`);
  const res = await fetch(src, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`OG font download failed: ${family} ${weight}`);
  return { name: family, data: await res.arrayBuffer(), weight, style: 'normal' };
}

// 한·일 어느 쪽 글자가 섞여도 나오도록 두 글꼴을 모두 넣음 (없는 글자는 다음 글꼴에서 찾음)
const SANS = 'IBM Plex Sans KR, IBM Plex Sans JP';
const MONO = 'JetBrains Mono';

async function loadFonts(sansText: string, monoText: string, sansWeights: FontWeight[]) {
  const specs: [FontSpec, string][] = [
    ...sansWeights.flatMap((weight): [FontSpec, string][] => [
      [{ family: 'IBM Plex Sans KR', weight }, sansText],
      [{ family: 'IBM Plex Sans JP', weight }, sansText],
    ]),
    [{ family: MONO, weight: 800 }, monoText],
    [{ family: MONO, weight: 500 }, monoText],
  ];
  // 해당 글자가 하나도 없는 글꼴은 Google이 파일을 주지 않음 (예: 일본어만 있는 문구를 KR 글꼴로 요청)
  // → 실패한 글꼴은 빼고 나머지로 그림. 전부 실패하면(네트워크 등) 에러
  const results = await Promise.allSettled(specs.map(([spec, text]) => loadGoogleFont(spec, text)));
  const fonts = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (fonts.length === 0) throw new Error('OG fonts could not be loaded');
  return fonts;
}

const WORDMARK = 'ahdeka.log';

function Wordmark({ size }: { size: number }) {
  const dot = WORDMARK.lastIndexOf('.');
  return (
    <div style={{ display: 'flex', fontFamily: MONO, fontWeight: 800, fontSize: size, letterSpacing: '-0.02em' }}>
      <span style={{ color: BRAND.fg }}>{WORDMARK.slice(0, dot)}</span>
      <span style={{ color: BRAND.accent }}>{WORDMARK.slice(dot)}</span>
    </div>
  );
}

export async function siteOgImage(description: string) {
  const fonts = await loadFonts(description, WORDMARK, [500]);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          background: CARD_BG,
        }}
      >
        <Mark size={136} />
        <Wordmark size={88} />
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, color: BRAND.muted }}>{description}</div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

export type PostOgInput = {
  title: string;
  category: { name: string; parent: string | null } | null;
  date: string; // "2026.11.10"
};

export async function postOgImage({ title, category, date }: PostOgInput) {
  const categoryText = category ? [category.parent, category.name].filter(Boolean).join(' › ') : '';
  const fonts = await loadFonts(`${title}${categoryText}›`, `${WORDMARK}${date}`, [600, 700]);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: CARD_BG,
        }}
      >
        {/* 위: 카테고리 경로 (없으면 빈 줄로 자리만) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 40, fontFamily: SANS, fontWeight: 600, fontSize: 30 }}>
          {category?.parent && (
            // 같은 색 조각을 나누면 하나로 합쳐지며 사이 간격이 사라짐 → 한 조각에 띄어쓰기로
            <span style={{ color: BRAND.muted }}>{`${category.parent} ›`}</span>
          )}
          {category && <span style={{ color: BRAND.accent }}>{category.name}</span>}
        </div>

        {/* 가운데: 제목 (최대 3줄) */}
        <div
          style={{
            display: 'block',
            lineClamp: 3,
            maxHeight: 64 * 1.32 * 3, // 줄 수 제한이 안 먹어도 3줄 높이를 넘지 않도록
            overflow: 'hidden',
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 64,
            lineHeight: 1.32,
            letterSpacing: '-0.015em',
            color: BRAND.fg,
          }}
        >
          {title}
        </div>

        {/* 아래: 마크 + 워드마크 · 날짜 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Mark size={60} />
            <Wordmark size={38} />
          </div>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 30, color: BRAND.muted }}>{date}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

// 글 카드 URL에 넣는 버전: 글을 수정하면 바뀜 → 새 URL이라 서버 캐시·SNS 캐시 모두 새 이미지
export const postOgVersion = (updatedAt: string) => Date.parse(updatedAt).toString(36);
