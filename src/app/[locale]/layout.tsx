import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import '../globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// /ja, /ko 두 개만 빌드 시 미리 생성. 그 외(/fr 등)는 404
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
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

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}