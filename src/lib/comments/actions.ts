'use server';

import { headers } from 'next/headers';
import { AUTHOR_NAME, AUTHOR_NICKNAME } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';
import { hashIp, hashPassword, verifyPassword } from './crypto';
import { verifyTurnstile } from './turnstile';
import { removeComment } from './queries';
import { revalidatePost } from './revalidate';
import {
  cleanBody,
  cleanNickname,
  BODY_MAX,
  MAX_LINKS,
  NICKNAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  type CommentActionResult,
} from './rules';

// ⚠️ Server Action은 누구나 직접 POST할 수 있는 공개 API.
//    인자 타입을 믿지 않고, 모든 검증을 여기서 다시 함 (Spring의 @Valid + Service 검증과 같은 역할)

const RATE_LIMITS = [
  { windowMs: 5 * 60_000, max: 3 }, // 5분에 3개
  { windowMs: 24 * 60 * 60_000, max: 20 }, // 하루 20개
];
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;

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
export async function createComment(raw: unknown): Promise<CommentActionResult> {
  const r = (raw ?? {}) as Record<string, unknown>;

  // 봇 함정: 화면에 보이지 않는 입력칸. 채워져 있으면 저장하지 않고 성공한 척
  if (typeof r.website === 'string' && r.website !== '') return { ok: true };

  const postId = String(r.postId ?? '');
  const parentId = r.parentId ? String(r.parentId) : null;
  const nickname = cleanNickname(r.nickname);
  const body = cleanBody(r.body);
  const password = String(r.password ?? '');
  const token = String(r.turnstileToken ?? '');

  if (
    !UUID.test(postId) ||
    (parentId !== null && !UUID.test(parentId)) ||
    nickname.length < 1 || nickname.length > NICKNAME_MAX ||
    body.length < 1 || body.length > BODY_MAX ||
    password.length < PASSWORD_MIN || password.length > PASSWORD_MAX
  ) {
    return { ok: false, code: 'invalid' };
  }
  if (isReservedNickname(nickname)) return { ok: false, code: 'reserved_nickname' };
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

    if (parentId) {
      const { data: parent, error } = await db
        .from('comments')
        .select('post_id, parent_id, deleted_at')
        .eq('id', parentId)
        .maybeSingle();
      if (error) throw error;
      // 같은 글의, 삭제되지 않은 최상위 댓글에만 답글 가능 (DB 트리거도 같은 규칙을 강제)
      if (!parent || parent.post_id !== postId || parent.parent_id || parent.deleted_at) {
        return { ok: false, code: 'not_found' };
      }
    }

    const passwordHash = await hashPassword(password);

    const { data: inserted, error: cError } = await db
      .from('comments')
      .insert({ post_id: postId, parent_id: parentId, nickname, body, is_author: false })
      .select('id')
      .single();
    if (cError) throw cError;

    const { error: sError } = await db
      .from('comment_secrets')
      .insert({ comment_id: inserted.id, password_hash: passwordHash, ip_hash: ipHash });
    if (sError) {
      // 비밀 정보 없이 남은 댓글은 아무도 지울 수 없으므로 되돌림
      await db.from('comments').delete().eq('id', inserted.id);
      throw sError;
    }

    revalidatePost(post.number as number);
    return { ok: true };
  } catch (err) {
    console.error('[comments] create failed', err);
    return { ok: false, code: 'server' };
  }
}

// ---------------------------------------------------------------------
// 본인 삭제 (작성 시 입력한 비밀번호)
// ---------------------------------------------------------------------
export async function deleteComment(raw: unknown): Promise<CommentActionResult> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const commentId = String(r.commentId ?? '');
  const password = String(r.password ?? '');
  if (!UUID.test(commentId) || password.length < 1 || password.length > PASSWORD_MAX) {
    return { ok: false, code: 'invalid' };
  }

  try {
    const db = createServiceClient();

    const { data: comment, error } = await db
      .from('comments')
      .select('id, parent_id, deleted_at, post:posts ( number )')
      .eq('id', commentId)
      .maybeSingle();
    if (error) throw error;
    if (!comment || comment.deleted_at) return { ok: false, code: 'not_found' };

    const { data: secret, error: sError } = await db
      .from('comment_secrets')
      .select('password_hash, failed_attempts, locked_until')
      .eq('comment_id', commentId)
      .maybeSingle();
    if (sError) throw sError;
    // 관리자 답글은 비밀 정보가 없음 → 비밀번호로는 절대 지울 수 없음
    if (!secret) return { ok: false, code: 'wrong_password' };

    if (secret.locked_until && new Date(secret.locked_until as string).getTime() > Date.now()) {
      return { ok: false, code: 'locked' };
    }

    if (!(await verifyPassword(password, secret.password_hash as string))) {
      const failed = (secret.failed_attempts as number) + 1;
      const lock = failed >= MAX_FAILED;
      await db
        .from('comment_secrets')
        .update({
          failed_attempts: lock ? 0 : failed,
          locked_until: lock ? new Date(Date.now() + LOCK_MS).toISOString() : null,
        })
        .eq('comment_id', commentId);
      return { ok: false, code: lock ? 'locked' : 'wrong_password' };
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
