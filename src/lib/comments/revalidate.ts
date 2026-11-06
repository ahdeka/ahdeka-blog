import 'server-only';
import { revalidatePath } from 'next/cache';
import { locales } from '@/i18n/config';

// 댓글은 언어 공통이므로 /ja, /ko 양쪽 글 페이지를 함께 갱신
export function revalidatePost(number: number) {
  for (const l of locales) revalidatePath(`/${l}/posts/${number}`);
}
