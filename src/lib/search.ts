// 검색어 규칙 (검색 화면 · 입력창 공용)
export const SEARCH_MAX = 100;

// ?q= 값 정리: 배열이면 첫 값, 앞뒤 공백 제거 + 연속 공백을 하나로, 최대 길이로 자름
export function normalizeSearch(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? '').trim().replace(/\s+/g, ' ').slice(0, SEARCH_MAX);
}
