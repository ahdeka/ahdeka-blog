// 목록 페이지 번호 파싱 (/page/[n] 경로, 검색의 ?page=)
// 2 이상의 정수만 유효. 1은 기본 주소와 같은 화면이라 따로 처리, 그 밖의 값은 null
export type PageParam = { kind: 'first' } | { kind: 'page'; n: number } | null;

export function parsePageParam(raw: string | string[] | undefined): PageParam {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || v === '1') return { kind: 'first' };
  // 앞자리 0(02)·부호·소수 등은 같은 페이지의 다른 주소가 되므로 받지 않음
  if (!/^[1-9]\d{0,5}$/.test(v)) return null;
  return { kind: 'page', n: Number(v) };
}
