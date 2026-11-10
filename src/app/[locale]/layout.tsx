import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { SITE_URL } from '@/lib/site';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import ThemeScript from '@/components/theme-script';
import { fontVariables } from '../fonts';
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
    alternates: {
      canonical: `/${locale}`,
      languages: { ja: '/ja', ko: '/ko', 'x-default': '/ja' },
    },
    // SNS 공유 기본 이미지 (src/app/[locale]/og). 글 상세처럼 openGraph를 따로 정하는 페이지는 이 값을 통째로 덮어씀
    openGraph: {
      type: 'website',
      siteName: dict.site.title,
      locale: locale === 'ja' ? 'ja_JP' : 'ko_KR',
      images: [{ url: `/${locale}/og`, width: 1200, height: 630, alt: dict.site.title }],
    },
    twitter: { card: 'summary_large_image', images: [`/${locale}/og`] },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    // data-theme은 ThemeScript가 그리기 전에 넣으므로 서버 HTML과 다를 수 있음 → 경고 억제
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
        {/* RSS 자동 탐지 (피드 리더·브라우저 확장이 이 링크로 피드를 찾음) */}
        <link rel="alternate" type="application/rss+xml" title={dict.site.title} href={`/${locale}/rss.xml`} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader locale={locale} dict={dict} />
        <div className="flex-1">{children}</div>
        <SiteFooter locale={locale} dict={dict} />
      </body>
    </html>
  );
}
