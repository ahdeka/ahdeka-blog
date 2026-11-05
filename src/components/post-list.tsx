import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { PublicPostSummary } from '@/lib/posts';

type Props = {
  locale: Locale;
  posts: PublicPostSummary[];
  emptyText: string;
};

// 홈(최신 글)과 /posts(전체 목록)가 같은 목록 UI를 쓰도록 한 곳에 모음
export default function PostList({ locale, posts, emptyText }: Props) {
  if (posts.length === 0) {
    return <p className="mt-8 text-neutral-500">{emptyText}</p>;
  }

  // Vercel 서버는 UTC라서 시간대를 명시하지 않으면 날짜가 하루 어긋날 수 있음
  const dateFormat = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Tokyo',
  });

  return (
    <ul className="mt-8 space-y-10">
      {posts.map((post) => (
        <li key={post.number}>
          <Link href={`/${locale}/posts/${post.number}`} className="group block">
            <div className="flex gap-3 text-sm text-neutral-500">
              <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>
              {post.category && <span>{post.category.name}</span>}
            </div>
            <h2 className="mt-1 text-xl font-semibold group-hover:underline">{post.title}</h2>
            {post.summary && (
              <p className="mt-2 leading-7 text-neutral-600 dark:text-neutral-400">{post.summary}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
