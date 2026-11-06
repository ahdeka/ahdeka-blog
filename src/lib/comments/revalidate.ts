import 'server-only';
import { revalidatePath } from 'next/cache';
import { locales } from '@/i18n/config';

// 댓글은 언어 공통이므로 /ja, /ko 양쪽을 함께 갱신
//  - 글 페이지: 댓글 목록
//  - 목록 페이지(홈·카테고리): 댓글 수, 사이드바 "최근 댓글"
//  (다른 글 상세 페이지는 건드리지 않음 → 캐시가 불필요하게 날아가지 않도록)
export function revalidatePost(number: number) {
  for (const l of locales) {
    revalidatePath(`/${l}/posts/${number}`);
    revalidatePath(`/${l}`);
  }
  revalidatePath('/[locale]/category/[slug]', 'page');
}
