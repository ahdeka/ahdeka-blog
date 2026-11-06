'use server';

import { getAdmin } from '@/lib/auth/admin';
import { AUTHOR_NAME } from '@/lib/site';
import { BODY_MAX, cleanBody } from '@/lib/comments/rules';
import { removeComment } from '@/lib/comments/queries';
import { revalidatePost } from '@/lib/comments/revalidate';

type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 관리자 세션(쿠키) 클라이언트로 처리 → RLS "comments: admin all"이 최종 방어선
// secret key는 쓰지 않음: 관리자 기능에서 RLS를 우회할 이유가 없음

// 관리자 삭제: 스팸 정리용이므로 답글까지 통째로 삭제
export async function adminDeleteComment(id: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, error: 'Invalid id' };

  const { data: comment, error } = await admin.supabase
    .from('comments')
    .select('id, parent_id, post:posts ( number )')
    .eq('id', id)
    .maybeSingle();
  if (error || !comment) return { ok: false, error: '댓글을 찾을 수 없습니다.' };

  try {
    await removeComment(admin.supabase, { id, parentId: comment.parent_id as string | null }, 'cascade');
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '삭제에 실패했습니다.' };
  }

  const post = comment.post as unknown as { number: number } | null;
  if (post) revalidatePost(post.number);
  return { ok: true };
}

// 작성자 답글: 닉네임 고정 + 작성자 배지. 비밀번호·Turnstile 불필요 (관리자 인증으로 대체)
// 답글에 답할 때는 그 답글의 부모 스레드에 붙임 (1단계 유지)
export async function adminReplyComment(targetId: string, rawBody: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: 'Unauthorized' };
  if (typeof targetId !== 'string' || !UUID.test(targetId)) return { ok: false, error: 'Invalid id' };

  const body = cleanBody(rawBody);
  if (body.length < 1 || body.length > BODY_MAX) return { ok: false, error: `본문은 1~${BODY_MAX}자로 입력하세요.` };

  const { supabase } = admin;
  const { data: target, error } = await supabase
    .from('comments')
    .select('id, post_id, parent_id')
    .eq('id', targetId)
    .maybeSingle();
  if (error || !target) return { ok: false, error: '댓글을 찾을 수 없습니다.' };

  const threadId = (target.parent_id as string | null) ?? (target.id as string);
  const { data: thread } = await supabase
    .from('comments')
    .select('deleted_at, post:posts ( number )')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread) return { ok: false, error: '댓글을 찾을 수 없습니다.' };
  if (thread.deleted_at) return { ok: false, error: '삭제된 댓글에는 답글을 달 수 없습니다.' };

  const { error: iError } = await supabase.from('comments').insert({
    post_id: target.post_id,
    parent_id: threadId,
    nickname: AUTHOR_NAME,
    body,
    is_author: true,
  });
  if (iError) return { ok: false, error: iError.message };

  const post = thread.post as unknown as { number: number } | null;
  if (post) revalidatePost(post.number);
  return { ok: true };
}
