import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { AUTHOR_NAME, GITHUB_URL } from '@/lib/site';
import { AuthorAvatar } from '@/components/profile';

// DB를 쓰지 않는 완전 정적 페이지 (빌드 시 /ja/about, /ko/about 생성)
// 내용은 사전(dictionaries)의 about 항목에서 수정
export const dynamic = 'force-static';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.about.title,
    alternates: {
      canonical: `/${locale}/about`,
      languages: { ja: '/ja/about', ko: '/ko/about', 'x-default': '/ja/about' },
    },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto max-w-[740px] px-4 pt-14 pb-24 sm:px-8">
      <h1 className="text-[38px] leading-(--lh-title) font-bold tracking-[-0.025em]">{dict.about.title}</h1>

      <div className="mt-8 flex items-center gap-5 border-b border-line pb-8">
        <AuthorAvatar size={72} />
        <div className="flex flex-col gap-1">
          <strong className="text-xl">{AUTHOR_NAME}</strong>
          <span className="mono text-[13px] text-fg-3">@{AUTHOR_NAME}</span>
        </div>
      </div>

      <div className="post-body mt-9">
        <p>{dict.about.lead}</p>
        <p>{dict.about.body}</p>
        <h2>{dict.about.links}</h2>
        <ul>
          <li>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}
