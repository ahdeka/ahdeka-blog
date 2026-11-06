// 언어 간 본문 구조 비교 (클라이언트 에디터 · 서버 저장 검사 공용)
// 원문은 항상 한국어. 번역본의 이미지는 원문과 같은 이미지가 같은 순서로 들어 있어야 함
// alt(설명)는 언어마다 달라도 되므로 URL만 비교

import type { Locale } from '@/i18n/config';

export const SOURCE_LOCALE = 'ko' satisfies Locale;

// ![alt](url) 또는 ![alt](url "title")
const IMAGE_RE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

// 코드 블록 안의 ![..](..) 는 이미지가 아니므로 제외
const FENCE_RE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;

export function extractImages(content: string): string[] {
  const text = content.replace(FENCE_RE, '');
  return Array.from(text.matchAll(IMAGE_RE), (m) => m[1]).filter((url) => !url.startsWith('uploading:'));
}

export type ImageDiff = {
  missing: string[]; // 원문에는 있는데 번역본에 없는 이미지
  extra: string[]; // 원문에 없는 이미지
  outOfOrder: boolean; // 구성은 같지만 순서가 다름
};

export function diffImages(source: string[], target: string[]): ImageDiff | null {
  if (source.length === target.length && source.every((url, i) => url === target[i])) return null;

  // 같은 이미지를 두 번 쓰는 경우도 있으므로 개수까지 세어 비교
  const remaining = new Map<string, number>();
  for (const url of target) remaining.set(url, (remaining.get(url) ?? 0) + 1);
  const missing: string[] = [];
  for (const url of source) {
    const n = remaining.get(url) ?? 0;
    if (n > 0) remaining.set(url, n - 1);
    else missing.push(url);
  }
  const extra = [...remaining].flatMap(([url, n]) => Array<string>(n).fill(url));
  return { missing, extra, outOfOrder: missing.length === 0 && extra.length === 0 };
}

// 원문 변경 감지용 해시 (보안 용도 아님: 동기 계산이 필요해서 cyrb53 사용)
export function sourceHash(t: { title: string; summary: string; content: string }): string {
  const str = `${t.title}\u0000${t.summary}\u0000${t.content}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function describeImageDiff(diff: ImageDiff): string {
  const parts: string[] = [];
  if (diff.missing.length) parts.push(`원문 이미지 ${diff.missing.length}개 누락`);
  if (diff.extra.length) parts.push(`원문에 없는 이미지 ${diff.extra.length}개`);
  if (diff.outOfOrder) parts.push('이미지 순서가 원문과 다름');
  return parts.join(' · ');
}
