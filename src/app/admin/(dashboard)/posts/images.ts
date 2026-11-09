import 'server-only';
import type { getAdmin } from '@/lib/auth/admin';

type Supabase = NonNullable<Awaited<ReturnType<typeof getAdmin>>>['supabase'];

// 저장하지 않고 버린 업로드(주인 없음)를 지우기까지의 유예 기간
// → 다른 탭에서 쓰는 중이거나 브라우저에 임시 보관된 새 글의 이미지는 남겨 둠
const ABANDONED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// LIKE 검색에서 _ 와 % 는 와일드카드이므로 이스케이프
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

// 저장 직전: 이 글이 쓰는 이미지를 post_images에 등록하고 이 글 소속으로 표시
// - 업로드 때 기록이 빠졌어도 여기서 채워짐
// - 다른 글 소속인 이미지(복사해서 재사용)는 주인을 바꾸지 않음
export async function registerImages(supabase: Supabase, paths: string[]) {
  if (!paths.length) return null;
  const { error } = await supabase
    .from('post_images')
    .upsert(paths.map((path) => ({ path })), { onConflict: 'path', ignoreDuplicates: true });
  return error;
}

export async function claimImages(supabase: Supabase, postId: string, paths: string[]) {
  if (!paths.length) return null;
  const { error } = await supabase.from('post_images').update({ post_id: postId }).in('path', paths).is('post_id', null);
  return error;
}

// 어느 글의 본문·커버에도 쓰이지 않는 이미지만 버킷과 post_images에서 지움
// 아직 쓰이는데 주인이 없는 이미지(원래 글이 삭제됨 등)는 쓰고 있는 글 소속으로 옮김
// → 다음 정리 때 같은 이미지를 또 검사하지 않음
// 실패해도 글 저장·삭제는 이미 끝났으므로 호출한 쪽은 안내만 함
export async function removeIfUnused(supabase: Supabase, paths: Iterable<string>): Promise<void> {
  const orphans: string[] = [];
  for (const path of new Set(paths)) {
    const [inContent, asCover] = await Promise.all([
      supabase.from('post_translations').select('post_id').ilike('content', `%${escapeLike(path)}%`).limit(1),
      supabase.from('posts').select('id').eq('cover_image_path', path).limit(1),
    ]);
    if (inContent.error) throw inContent.error;
    if (asCover.error) throw asCover.error;

    const user = (inContent.data?.[0]?.post_id ?? asCover.data?.[0]?.id) as string | undefined;
    if (!user) {
      orphans.push(path);
      continue;
    }
    const { error } = await supabase.from('post_images').update({ post_id: user }).eq('path', path).is('post_id', null);
    if (error) throw error;
  }
  if (!orphans.length) return;

  const { error: rmError } = await supabase.storage.from('post-images').remove(orphans);
  if (rmError) throw rmError;
  const { error } = await supabase.from('post_images').delete().in('path', orphans);
  if (error) throw error;
}

// 글 저장 후: 이 글 소속인데 더 이상 안 쓰는 이미지 + 오래된 주인 없는 업로드를 정리
export async function cleanupAfterSave(supabase: Supabase, postId: string, used: Set<string>): Promise<void> {
  const before = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString();
  const [owned, abandoned] = await Promise.all([
    supabase.from('post_images').select('path').eq('post_id', postId),
    supabase.from('post_images').select('path').is('post_id', null).lt('created_at', before).limit(50),
  ]);
  if (owned.error) throw owned.error;
  if (abandoned.error) throw abandoned.error;

  const candidates = [
    ...(owned.data ?? []).map((r) => r.path as string).filter((p) => !used.has(p)),
    ...(abandoned.data ?? []).map((r) => r.path as string),
  ];
  await removeIfUnused(supabase, candidates);
}
