import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { SITE_URL } from '@/lib/site';
import SiteHeader from '@/components/site-header';
import '../globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// /ja, /ko 두 개만 빌드 시 미리 생성
// ⚠️ 여기에 dynamicParams = false 를 두지 말 것: 하위 세그먼트([number] 등)까지 상속되어
//    빌드 이후에 생긴 새 글이 404가 됨. 지원하지 않는 언어(/fr 등)는 아래 isLocale 체크로 404 처리
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: dict.site.title, template: `%s | ${dict.site.title}` },
    description: dict.site.description,
    // hreflang: 같은 페이지의 다른 언어 버전을 검색엔진에 알려줌
    // (글 상세 페이지는 나중에 번역 존재 여부에 따라 개별 설정)
    alternates: {
      canonical: `/${locale}`,
      languages: { ja: '/ja', ko: '/ko', 'x-default': '/ja' },
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <SiteHeader locale={locale} dict={dict} />
        {children}
      </body>
    </html>
  );
}