import { isLocale, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getPublishedPosts } from '@/lib/posts';
import { SITE_URL } from '@/lib/site';

// 언어별 RSS 피드: /ko/rss.xml, /ja/rss.xml
// 빌드 시 생성 후 캐시. 글 저장 시 revalidatePublic()에서 갱신, 이 값은 안전망
export const dynamic = 'force-static';
export const revalidate = 86400;

const MAX_ITEMS = 20;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response('Not Found', { status: 404 });

  const [dict, posts] = await Promise.all([getDictionary(locale), getPublishedPosts(locale, MAX_ITEMS)]);
  const home = `${SITE_URL}/${locale}`;
  const self = `${home}/rss.xml`;

  const items = posts.map((p) => {
    const url = `${home}/posts/${p.number}`;
    const category = p.category ? (p.category.parent ? `${p.category.parent.name} › ${p.category.name}` : p.category.name) : null;
    return [
      '    <item>',
      `      <title>${escapeXml(p.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>`,
      p.summary ? `      <description>${escapeXml(p.summary)}</description>` : null,
      category ? `      <category>${escapeXml(category)}</category>` : null,
      ...p.tags.map((t) => `      <category>${escapeXml(t.name)}</category>`),
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n');
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(dict.site.title)}</title>
    <link>${home}</link>
    <description>${escapeXml(dict.site.description)}</description>
    <language>${locale === 'ja' ? 'ja-JP' : 'ko-KR'}</language>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
${posts[0] ? `    <lastBuildDate>${new Date(posts[0].publishedAt).toUTCString()}</lastBuildDate>\n` : ''}${items.join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
