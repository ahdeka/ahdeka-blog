import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { SITE_URL } from '@/lib/site';
import { clip, notifyDiscord } from './discord';

// 방문자 댓글 알림 (운영자 본인 댓글은 알리지 않음)
// after()에서 호출 → 댓글 작성 응답이 끝난 뒤 실행되어 작성자를 기다리게 하지 않음
export async function notifyNewComment(c: {
  id: string;
  postId: string;
  postNumber: number;
  threadId: string | null;
  nickname: string;
  body: string;
}): Promise<void> {
  const db = createServiceClient();
  const [title, parent] = await Promise.all([
    db
      .from('post_translations')
      .select('title')
      .eq('post_id', c.postId)
      .eq('locale', 'ko')
      .maybeSingle()
      .then(({ data }) => (data?.title as string | undefined) ?? `#${c.postNumber}`),
    c.threadId
      ? db
          .from('comments')
          .select('nickname, is_author')
          .eq('id', c.threadId)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);

  const who = c.nickname || '익명';
  const parentName = parent ? (parent.is_author ? '내 댓글' : `${parent.nickname || '익명'} 님 댓글`) : null;

  await notifyDiscord({
    title: clip(`💬 ${title}`, 250),
    url: `${SITE_URL}/ko/posts/${c.postNumber}#comment-${c.id}`,
    description: clip(c.body, 2000),
    color: 0x2dd4bf, // 파비콘 커서 색
    fields: [
      { name: '작성자', value: clip(who, 100), inline: true },
      ...(parentName ? [{ name: '답글 대상', value: clip(parentName, 100), inline: true }] : []),
    ],
    footer: { text: '관리: /admin/comments' },
    timestamp: new Date().toISOString(),
  });
}
