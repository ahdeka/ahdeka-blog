// 업로드 이미지의 Storage 경로 ↔ 공개 URL (서버·클라이언트 공용)
// 경로 형식은 RLS(0003)·post_images(0007)의 검사와 같음: {yyyy}/{uuid}_{가로}x{세로}.webp
import { extractImages } from '@/lib/post-structure';

const PATH = '[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[1-9][0-9]{0,4}x[1-9][0-9]{0,4}\\.webp';
const PATH_RE = new RegExp(`^${PATH}$`);
const URL_RE = new RegExp(`/storage/v1/object/public/post-images/(${PATH})$`);

export const isImagePath = (v: unknown): v is string => typeof v === 'string' && PATH_RE.test(v);

// 본문의 이미지 URL → 경로. 이 블로그에 올린 이미지가 아니면 null
export function imagePathFromUrl(url: string): string | null {
  return URL_RE.exec(url)?.[1] ?? null;
}

export function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;
}

// 본문에 들어 있는 업로드 이미지 경로 (중복 제거, 등장 순서)
export function imagePathsInContent(content: string): string[] {
  const paths = extractImages(content).map(imagePathFromUrl).filter((p): p is string => p !== null);
  return [...new Set(paths)];
}
