import 'server-only';
import { revalidatePath } from 'next/cache';

// 글·카테고리 등 공개 화면에 보이는 데이터를 바꾼 뒤 호출
export function revalidatePublic() {
  // /ja, /ko 아래 모든 공개 페이지 캐시 갱신
  revalidatePath('/[locale]', 'layout');
  // sitemap은 [locale] 밖이라 따로 갱신
  revalidatePath('/sitemap.xml');
}
