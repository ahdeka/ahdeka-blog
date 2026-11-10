'use server';

import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdmin } from '@/lib/auth/admin';
import { AUTHOR_NAME, AUTHOR_NICKNAME } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';
import { createDeleteToken, hashIp, verifyDeleteToken } from './crypto';
import { verifyTurnstile } from './turnstile';
import { removeComment } from './queries';
import { revalidatePost } from './revalidate';
import {
  cleanBody,
  cleanNickname,
  BODY_MAX,
  DELETE_WINDOW_MS,
  MAX_LINKS,
  NICKNAME_MAX,
  type CommentActionResult,
  type CreateCommentResult,
} from './rules';

// ⚠️ Server Action은 누구나 직접 POST할 수 있는 공개 API.
//    인자 타입을 믿지 않고, 모든 검증을 여기서 다시 함 (Spring의 @Valid + Service 검증과 같은 역할)

const RATE_LIMITS = [
  { windowMs: 5 * 60_000, max: 3 }, // 5분에 3개
  { windowMs: 24 * 60 * 60_000, max: 20 }, // 하루 20개
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 작성자 사칭 방지: 전각·대소문자·공백 차이를 없앤 뒤 비교
function isReservedNickname(nickname: string): boolean {
  const n = nickname.normalize('NFKC').toLowerCase().replace(/\s/g, '');
  if (n.includes(AUTHOR_NAME.toLowerCase())) return true;
  // 닉네임(다미·ダミ)은 짧아서 포함 검사를 하면 정상 닉네임까지 막히므로 완전 일치만 금지
  if (Object.values(AUTHOR_NICKNAME).some((nick) => n === nick.normalize('NFKC').toLowerCase())) return true;
  return ['admin', '관리자', '管理者', '作成者', '작성자'].includes(n);
}

// Vercel은 x-forwarded-for를 클라이언트 IP로 덮어써서 전달함 (클라이언트가 위조한 값이 섞이지 않음)
async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

// ---------------------------------------------------------------------
// 댓글·답글 작성
// ---------------------------------------------------------------------
export async function createComment(raw: unknown): Promise<CreateCommentResult> {
  const r = (raw ?? {}) as Record<string, unknown>;

  // 봇 함정: 화면에 보이지 않는 입력칸. 채워져 있으면 저장하지 않고 성공한 척
  if (typeof r.website === 'string' && r.website !== '') return { ok: true };

  const postId = String(r.postId ?? '');
  const parentId = r.parentId ? String(r.parentId) : null;
  const nickname = cleanNickname(r.nickname); // 비어 있으면 익명
  const body = cleanBody(r.body);
  const token = String(r.turnstileToken ?? '');

  if (
    !UUID.test(postId) ||
    (parentId !== null && !UUID.test(parentId)) ||
    nickname.length > NICKNAME_MAX ||
    body.length < 1 || body.length > BODY_MAX
  ) {
    return { ok: false, code: 'invalid' };
  }
  // 운영자: 로그인 세션을 서버에서 다시 확인한 뒤 작성자 댓글로 (닉네임·Turnstile·rate limit 불필요)
  if (r.asAuthor === true) return createAuthorComment(postId, parentId, body);

  if (nickname && isReservedNickname(nickname)) return { ok: false, code: 'reserved_nickname' };
  if ((body.match(/https?:\/\/|www\./gi)?.length ?? 0) > MAX_LINKS) return { ok: false, code: 'too_many_links' };

  const ip = await getClientIp();
  // 값싼 검사 → 외부 API(Turnstile) → DB 순서로, 뒤로 갈수록 비싼 검사
  if (!(await verifyTurnstile(token, ip))) return { ok: false, code: 'captcha' };

  try {
    const db = createServiceClient();
    const ipHash = hashIp(ip ?? 'unknown');

    for (const { windowMs, max } of RATE_LIMITS) {
      const { count, error } = await db
        .from('comment_secrets')
        .select('comment_id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', new Date(Date.now() - windowMs).toISOString());
      if (error) throw error;
      if ((count ?? 0) >= max) return { ok: false, code: 'rate_limited' };
    }

    // secret key는 RLS를 우회하므로 "공개된 글인지"를 직접 확인해야 함
    const { data: post, error: pError } = await db
      .from('posts')
      .select('id, number')
      .eq('id', postId)
      .eq('status', 'published')
      .maybeSingle();
    if (pError) throw pError;
    if (!post) return { ok: false, code: 'not_found' };

    const threadId = parentId ? await resolveThreadId(db, postId, parentId) : null;
    if (parentId && !threadId) return { ok: false, code: 'not_found' };

    const deleteToken = createDeleteToken();

    const { data: inserted, error: cError } = await db
      .from('comments')
      .insert({ post_id: postId, parent_id: threadId, nickname, body, is_author: false })
      .select('id')
      .single();
    if (cError) throw cError;

    const { error: sError } = await db
      .from('comment_secrets')
      .insert({ comment_id: inserted.id, delete_token_hash: deleteToken.hash, ip_hash: ipHash });
    if (sError) {
      // 비밀 정보 없이 남은 댓글은 rate limit에도 잡히지 않으므로 되돌림
      await db.from('comments').delete().eq('id', inserted.id);
      throw sError;
    }

    revalidatePost(post.number as number);
    return { ok: true, commentId: inserted.id as string, deleteToken: deleteToken.token };
  } catch (err) {
    console.error('[comments] create failed', err);
    return { ok: false, code: 'server' };
  }
}

// 답글 대상 → 실제로 붙일 스레드(최상위 댓글) id
// 답글에 답글을 달아도 같은 스레드 맨 아래에 붙음 (1단계 유지, DB 트리거도 같은 규칙을 강제)
// 같은 글이 아니거나, 스레드가 삭제(묘비)됐으면 null
async function resolveThreadId(db: SupabaseClient, postId: string, parentId: string): Promise<string | null> {
  const { data: parent, error } = await db
    .from('comments')
    .select('id, post_id, parent_id')
    .eq('id', parentId)
    .maybeSingle();
  if (error) throw error;
  if (!parent || parent.post_id !== postId) return null;

  const threadId = (parent.parent_id as string | null) ?? (parent.id as string);
  const { data: thread, error: tError } = await db
    .from('comments')
    .select('deleted_at')
    .eq('id', threadId)
    .maybeSingle();
  if (tError) throw tError;
  if (!thread || thread.deleted_at) return null;
  return threadId;
}

// 운영자 댓글: 관리자 세션 클라이언트로 저장 → RLS "comments: admin all"이 최종 방어선
// 비밀 정보(삭제 토큰·IP)는 저장하지 않음 → 삭제는 관리자 화면에서
async function createAuthorComment(postId: string, parentId: string | null, body: string): Promise<CreateCommentResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, code: 'unauthorized' };

  try {
    const db = admin.supabase;
    const { data: post, error: pError } = await db
      .from('posts')
      .select('id, number')
      .eq('id', postId)
      .eq('status', 'published')
      .maybeSingle();
    if (pError) throw pError;
    if (!post) return { ok: false, code: 'not_found' };

    const threadId = parentId ? await resolveThreadId(db, postId, parentId) : null;
    if (parentId && !threadId) return { ok: false, code: 'not_found' };

    const { error } = await db
      .from('comments')
      .insert({ post_id: postId, parent_id: threadId, nickname: AUTHOR_NAME, body, is_author: true });
    if (error) throw error;

    revalidatePost(post.number as number);
    return { ok: true };
  } catch (err) {
    console.error('[comments] author create failed', err);
    return { ok: false, code: 'server' };
  }
}

// 지금 보는 사람이 운영자인지 (댓글 폼을 운영자 모드로 바꿀지)
// 공개 페이지는 ISR이라 렌더링 때 쿠키를 읽을 수 없음 → 브라우저가 로그인 쿠키가 있을 때만 따로 물어봄
export async function getCommentViewer(): Promise<{ isAuthor: boolean }> {
  try {
    return { isAuthor: (await getAdmin()) !== null };
  } catch {
    return { isAuthor: false };
  }
}

// ---------------------------------------------------------------------
// 본인 삭제: 작성한 브라우저에 보관된 삭제 토큰 + 작성 후 15분 이내
// 토큰은 256비트 난수라 대입 공격이 불가능 → 실패 횟수 잠금 불필요
// ---------------------------------------------------------------------
export async function deleteComment(raw: unknown): Promise<CommentActionResult> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const commentId = String(r.commentId ?? '');
  const deleteToken = String(r.deleteToken ?? '');
  if (!UUID.test(commentId) || deleteToken.length < 1 || deleteToken.length > 100) {
    return { ok: false, code: 'invalid' };
  }

  try {
    const db = createServiceClient();

    const { data: comment, error } = await db
      .from('comments')
      .select('id, parent_id, created_at, deleted_at, post:posts ( number )')
      .eq('id', commentId)
      .maybeSingle();
    if (error) throw error;
    if (!comment || comment.deleted_at) return { ok: false, code: 'not_found' };

    // 시간 제한은 브라우저가 아닌 DB의 작성 시각 기준 (버튼 숨김만으로는 우회 가능하므로)
    if (Date.now() - new Date(comment.created_at as string).getTime() > DELETE_WINDOW_MS) {
      return { ok: false, code: 'expired' };
    }

    const { data: secret, error: sError } = await db
      .from('comment_secrets')
      .select('delete_token_hash')
      .eq('comment_id', commentId)
      .maybeSingle();
    if (sError) throw sError;
    // 관리자 답글·이전 방식 댓글은 토큰이 없음 → 방문자는 지울 수 없음
    if (!secret?.delete_token_hash || !verifyDeleteToken(deleteToken, secret.delete_token_hash as string)) {
      return { ok: false, code: 'forbidden' };
    }

    await removeComment(db, { id: comment.id as string, parentId: comment.parent_id as string | null }, 'keep-replies');

    const post = comment.post as unknown as { number: number } | null;
    if (post) revalidatePost(post.number);
    return { ok: true };
  } catch (err) {
    console.error('[comments] delete failed', err);
    return { ok: false, code: 'server' };
  }
}
