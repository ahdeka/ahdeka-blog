import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { imageSizeFromUrl } from '@/lib/images/dimensions';

const components: Components = {
  // next/image는 쓰지 않음: Vercel 이미지 최적화 한도를 소모하지 않도록,
  // 업로드 시점에 이미 리사이즈·WebP 변환을 끝내 둠
  img({ src, alt }) {
    if (typeof src !== 'string' || !src) return null;
    // 파일명에 담긴 크기로 비율 공간을 미리 확보 → 로딩 중 본문이 밀리지 않음
    const size = imageSizeFromUrl(src);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ''}
        width={size?.width}
        height={size?.height}
        loading="lazy"
        decoding="async"
        className="mx-auto my-6 h-auto max-w-full rounded-lg"
      />
    );
  },
};

// 관리자 미리보기와 공개 페이지가 같은 렌더러·같은 스타일을 쓰도록 한 곳에 모음
// → "미리보기와 실제 화면이 다르다"는 문제가 생기지 않음
// ⚠️ rehype-raw 플러그인은 추가하지 말 것 (본문 속 HTML이 실행되어 XSS 가능)
export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="text-[16px] leading-[1.9] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-4 [&_blockquote]:text-neutral-500 dark:[&_blockquote]:border-neutral-700 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:text-[0.9em] dark:[&_code]:bg-neutral-800 [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:my-1 [&_ol]:list-decimal [&_p]:my-4 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-4 dark:[&_pre]:bg-neutral-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-4 [&_td]:border [&_td]:border-neutral-300 [&_td]:px-3 [&_td]:py-1 dark:[&_td]:border-neutral-700 [&_th]:border [&_th]:border-neutral-300 [&_th]:px-3 [&_th]:py-1 dark:[&_th]:border-neutral-700 [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}