// 브라우저 전용: 내가 쓴 댓글의 삭제 토큰 보관 (localStorage)
// - 만료 시각은 이 브라우저 시계 기준으로 저장 → 서버와 시계가 달라도 "작성 후 15분"이 어긋나지 않음
// - 서버도 DB 작성 시각으로 다시 검사하므로, 여기 값은 버튼 표시용
import { DELETE_WINDOW_MS } from './rules';

const KEY = 'comment-delete-tokens';
// 같은 탭에서 저장·삭제가 일어났을 때 댓글 목록에 알림 (storage 이벤트는 다른 탭에만 옴)
export const DELETE_TOKENS_EVENT = 'comment-delete-tokens-change';

type Entry = { token: string; expiresAt: number };
type Store = Record<string, Entry>;

function read(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
    // 만료된 항목은 읽을 때 정리
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, e]) => e && typeof e.token === 'string' && e.expiresAt > now));
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
  window.dispatchEvent(new Event(DELETE_TOKENS_EVENT));
}

export function saveDeleteToken(commentId: string, token: string) {
  write({ ...read(), [commentId]: { token, expiresAt: Date.now() + DELETE_WINDOW_MS } });
}

export function getDeleteToken(commentId: string): Entry | null {
  return read()[commentId] ?? null;
}

export function removeDeleteToken(commentId: string) {
  const store = read();
  delete store[commentId];
  write(store);
}
