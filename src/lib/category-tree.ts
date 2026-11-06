// 카테고리 2단계 트리 정렬 (관리자·공개 화면 공용, 순수 함수)
// 상위 → 그 하위들 → 다음 상위 … 순서로 펼친 목록을 돌려줌

type Node = { id: number; parent_id: number | null; sort_order: number };

export function flattenTree<T extends Node>(rows: T[]): (T & { depth: 0 | 1 })[] {
  const bySort = (a: T, b: T) => a.sort_order - b.sort_order || a.id - b.id;
  const ids = new Set(rows.map((r) => r.id));
  // 상위가 목록에 없으면(이론상 없음) 최상위로 취급해 사라지지 않게 함
  const roots = rows.filter((r) => r.parent_id === null || !ids.has(r.parent_id)).sort(bySort);
  return roots.flatMap((root) => [
    { ...root, depth: 0 as const },
    ...rows
      .filter((r) => r.parent_id === root.id)
      .sort(bySort)
      .map((child) => ({ ...child, depth: 1 as const })),
  ]);
}
