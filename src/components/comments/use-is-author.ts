'use client';

import { useEffect, useState } from 'react';
import { getCommentViewer } from '@/lib/comments/actions';

// Supabase 로그인 쿠키 (sb-<project>-auth-token, 길면 .0 .1 로 나뉨)
// 일반 방문자는 이 쿠키가 없으므로 서버에 묻지 않음 → 추가 요청 0
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=]*-auth-token/;

// 페이지 안의 여러 폼(하단 폼·답글 폼)이 같은 결과를 공유 → 요청은 페이지당 1번
let cached: Promise<boolean> | null = null;

function fetchIsAuthor(): Promise<boolean> {
  if (!AUTH_COOKIE.test(document.cookie)) return Promise.resolve(false);
  cached ??= getCommentViewer()
    .then((r) => r.isAuthor)
    .catch(() => false);
  return cached;
}

// 운영자(관리자 로그인 + 2단계 인증) 상태면 true. 최종 판정은 작성할 때 서버가 다시 함
export function useIsAuthor(): boolean {
  const [isAuthor, setIsAuthor] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchIsAuthor().then((v) => {
      if (alive) setIsAuthor(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return isAuthor;
}
