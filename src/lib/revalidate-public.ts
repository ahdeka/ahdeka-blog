import 'server-only';
import { revalidatePath } from 'next/cache';
import { locales } from '@/i18n/config';

// 글·카테고리 등 공개 화면에 보이는 데이터를 바꾼 뒤 호출
export function revalidatePublic() {
  // /ja, /ko 아래 모든 공개 페이지 캐시 갱신
  revalidatePath('/[locale]', 'layout');
  // sitemap은 [locale] 밖이라 따로 갱신
  revalidatePath('/sitemap.xml');
  // RSS(Route Handler)는 레이아웃 갱신에 포함되는지 보장되지 않아 경로를 직접 지정
  for (const locale of locales) revalidatePath(`/${locale}/rss.xml`);
}
