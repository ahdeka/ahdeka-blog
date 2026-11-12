import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { AUTHOR_NAME, AUTHOR_NICKNAME } from '@/lib/site';
import { AuthorAvatar, ProfileLinks } from '@/components/profile';
import MarkdownView from '@/components/markdown-view';

// DB를 쓰지 않는 완전 정적 페이지 (빌드 시 /ja/about, /ko/about 생성)
// 한 줄 소개는 사전(profile.bio, 사이드바와 공용), 본문은 content/about/{locale}.md에서 수정
export const dynamic = 'force-static';

type Props = { params: Promise<{ locale: string }> };

const readAbout = (locale: Locale) => readFile(path.join(process.cwd(), 'content', 'about', `${locale}.md`), 'utf8');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.about.title,
    description: dict.profile.bio.replace(/\n/g, ' '),
    alternates: {
      canonical: `/${locale}/about`,
      languages: { ja: '/ja/about', ko: '/ko/about', 'x-default': '/ja/about' },
    },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, body] = await Promise.all([getDictionary(locale), readAbout(locale)]);

  return (
    <main className="mx-auto max-w-[740px] px-4 pt-14 pb-24 sm:px-8">
      <h1 className="text-[38px] leading-(--lh-title) font-bold tracking-[-0.025em]">{dict.about.title}</h1>

      <div className="mt-8 flex flex-col gap-5 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          <AuthorAvatar size={88} />
          <div className="flex flex-col gap-1">
            <strong className="text-xl">{AUTHOR_NICKNAME[locale]}</strong>
            <span className="mono text-[13px] text-fg-3">@{AUTHOR_NAME}</span>
          </div>
        </div>
        <p className="leading-[1.8] whitespace-pre-line text-fg-2">{dict.profile.bio}</p>
        <ProfileLinks />
      </div>

      <div className="mt-9">
        <MarkdownView content={body} labels={dict.markdown} />
      </div>
    </main>
  );
}
