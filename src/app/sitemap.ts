import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { getPublishedPostRefs } from '@/lib/posts';
import { SITE_URL } from '@/lib/site';

// 빌드 시 1회 생성 후 캐시. 글 저장 시 revalidatePath('/sitemap.xml')로 갱신, 이 값은 안전망
export const revalidate = 86400;

// 같은 페이지의 ja/ko 버전을 한 묶음으로 등록 (hreflang 포함)
function entry(path: string, lastModified?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    ['x-default', `${SITE_URL}/${defaultLocale}${path}`],
  ]);
  return locales.map((l) => ({
    url: `${SITE_URL}/${l}${path}`,
    lastModified,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPostRefs();
  const latest = posts.reduce<string | undefined>(
    (max, p) => (!max || p.updatedAt > max ? p.updatedAt : max),
    undefined,
  );

  return [
    ...entry('', latest),
    ...entry('/posts', latest),
    ...posts.flatMap((p) => entry(`/posts/${p.number}`, p.updatedAt)),
  ];
}
