import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient } from '@/lib/supabase/public-server';

export type PublicComment = {
  id: string;
  nickname: string;
  body: string;
  isAuthor: boolean;
  createdAt: string;
  deleted: boolean; // 답글이 남아 있어서 자리만 남긴 댓글
};
export type CommentThread = PublicComment & { replies: PublicComment[] };

type Row = {
  id: string;
  parent_id: string | null;
  nickname: string;
  body: string;
  is_author: boolean;
  created_at: string;
  deleted_at: string | null;
};

const toPublic = (r: Row): PublicComment => ({
  id: r.id,
  nickname: r.nickname,
  body: r.body,
  isAuthor: r.is_author,
  createdAt: r.created_at,
  deleted: r.deleted_at !== null,
});

// 공개 페이지(ISR)용: 쿠키 없는 클라이언트 + RLS(공개된 글의 댓글만)
// 글 상세가 다시 렌더링될 때만 호출됨 → 방문 수와 무관하게 DB 호출이 적음
export async function getCommentThreads(postId: string): Promise<{ threads: CommentThread[]; count: number }> {
  const { data, error } = await createPublicClient()
    .from('comments')
    .select('id, parent_id, nickname, body, is_author, created_at, deleted_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const threads = new Map<string, CommentThread>();
  for (const r of rows) if (!r.parent_id) threads.set(r.id, { ...toPublic(r), replies: [] });
  for (const r of rows) if (r.parent_id) threads.get(r.parent_id)?.replies.push(toPublic(r));

  return {
    threads: [...threads.values()],
    count: rows.filter((r) => r.deleted_at === null).length,
  };
}

// ---------------------------------------------------------------------
// 댓글 제거 (방문자 본인 삭제·관리자 삭제 공용)
//  - 방문자 삭제: 답글이 달린 최상위 댓글이면 내용만 비운 "묘비"로 남김
//  - 관리자 삭제(cascade): 스팸 정리용. 답글까지 통째로 삭제
//  - 답글을 지운 뒤 부모가 묘비이고 남은 답글이 없으면 부모도 정리
//    → 의미 없는 행이 쌓이지 않음
// client: 방문자 삭제는 secret key 클라이언트, 관리자 삭제는 관리자 세션 클라이언트(RLS: admin all)
// ---------------------------------------------------------------------
export async function removeComment(
  client: SupabaseClient,
  comment: { id: string; parentId: string | null },
  mode: 'keep-replies' | 'cascade',
): Promise<void> {
  if (!comment.parentId && mode === 'keep-replies') {
    const { count, error } = await client
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', comment.id);
    if (error) throw error;

    if (count && count > 0) {
      const { error: uError } = await client
        .from('comments')
        .update({ deleted_at: new Date().toISOString(), nickname: '', body: '' })
        .eq('id', comment.id);
      if (uError) throw uError;
      // 비밀번호 등은 더 이상 필요 없으므로 삭제 (secret key일 때만 접근 가능, 관리자는 해당 없음)
      await client.from('comment_secrets').delete().eq('comment_id', comment.id);
      return;
    }
  }

  // 답글·비밀 정보는 on delete cascade 로 함께 삭제됨
  const { error } = await client.from('comments').delete().eq('id', comment.id);
  if (error) throw error;

  if (comment.parentId) {
    const { data: parent } = await client
      .from('comments')
      .select('deleted_at')
      .eq('id', comment.parentId)
      .maybeSingle();
    if (parent?.deleted_at) {
      const { count } = await client
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', comment.parentId);
      if (count === 0) await client.from('comments').delete().eq('id', comment.parentId);
    }
  }
}
