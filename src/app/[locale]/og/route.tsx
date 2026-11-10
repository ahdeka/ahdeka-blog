import { isLocale, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { siteOgImage } from '@/lib/og';

// 기본 공유 이미지: /ko/og, /ja/og (빌드 시 생성 후 캐시)
// 이미지가 따로 없는 페이지는 [locale]/layout.tsx의 openGraph.images로 이 이미지를 씀
export const dynamic = 'force-static';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response('Not Found', { status: 404 });
  const dict = await getDictionary(locale);
  return siteOgImage(dict.site.description);
}
