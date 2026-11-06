import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Blockquote, Paragraph, PhrasingContent, Root as MdRoot, RootContent } from 'mdast';
import type { Element, ElementContent, Root as HastRoot } from 'hast';
import { imageSizeFromUrl } from '@/lib/images/dimensions';
import CopyButton from './copy-button';

// 관리자 미리보기와 공개 페이지가 같은 렌더러·같은 스타일을 쓰도록 한 곳에 모음
// → "미리보기와 실제 화면이 다르다"는 문제가 생기지 않음
// ⚠️ rehype-raw 플러그인은 추가하지 말 것 (본문 속 HTML이 실행되어 XSS 가능)

export type Heading = { id: string; text: string; level: 2 | 3 };

// ---------------------------------------------------------------------
// 안내 박스:
//   :::info          (또는 :::warn)
//   내용 (여러 문단 가능)
//   :::
// 별도 패키지 없이, 위 형식의 문단들을 찾아 <aside class="callout">로 바꿈
// ---------------------------------------------------------------------
const CALLOUT_OPEN = /^:::(info|warn)[ \t]*(?:\n|$)/;
const CALLOUT_CLOSE = /(?:^|\n):::[ \t]*$/;

const hasContent = (kids: PhrasingContent[]) => kids.some((c) => c.type !== 'text' || c.value.trim() !== '');

function transformCallouts(children: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const head = node.type === 'paragraph' ? node.children[0] : undefined;
    const open = head?.type === 'text' ? head.value.match(CALLOUT_OPEN) : null;
    if (!open || node.type !== 'paragraph' || head?.type !== 'text') {
      out.push(node);
      continue;
    }

    // 여는 줄(:::info)을 지운 첫 문단부터 닫는 줄(:::)이 나올 때까지 모음
    const body: RootContent[] = [];
    let cur: RootContent = { ...node, children: [{ ...head, value: head.value.slice(open[0].length) }, ...node.children.slice(1)] };
    let j = i;
    let closed = false;
    for (;;) {
      if (cur.type === 'paragraph') {
        const last = cur.children.at(-1);
        if (last?.type === 'text' && CALLOUT_CLOSE.test(last.value)) {
          const rest = last.value.replace(CALLOUT_CLOSE, '');
          const kids = [...cur.children.slice(0, -1), ...(rest ? [{ ...last, value: rest }] : [])];
          if (hasContent(kids)) body.push({ ...cur, children: kids } as Paragraph);
          closed = true;
          break;
        }
        if (hasContent(cur.children)) body.push(cur);
      } else {
        body.push(cur);
      }
      if (++j >= children.length) break;
      cur = children[j];
    }

    // 닫는 줄이 없으면 일반 문단으로 둠 (작성 중인 글이 깨져 보이지 않도록)
    if (!closed) {
      out.push(node);
      continue;
    }
    out.push({
      type: 'blockquote',
      data: { hName: 'aside', hProperties: { className: ['callout'], dataKind: open[1] } },
      children: body,
    } as Blockquote);
    i = j;
  }
  return out;
}

const remarkCallouts = () => (tree: MdRoot) => {
  tree.children = transformCallouts(tree.children);
};

// ---------------------------------------------------------------------
// 제목(h2·h3)에 id를 붙이고 목차용으로 모음
// ---------------------------------------------------------------------
function textOf(node: ElementContent | Element): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return node.children.map((c) => textOf(c as ElementContent)).join('');
  return '';
}

function slugify(text: string): string {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return s || 'section';
}

const rehypeHeadings = (collected: Heading[]) => () => (tree: HastRoot) => {
  const used = new Map<string, number>();
  const walk = (node: HastRoot | ElementContent) => {
    if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3')) {
      const text = textOf(node).trim();
      const base = slugify(text);
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n}`;
      node.properties = { ...node.properties, id };
      collected.push({ id, text, level: node.tagName === 'h2' ? 2 : 3 });
      return;
    }
    if ('children' in node) node.children.forEach((c) => walk(c as ElementContent));
  };
  walk(tree);
};

// ---------------------------------------------------------------------
// 요소별 렌더링
// ---------------------------------------------------------------------
const InfoIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

const components: Components = {
  // next/image는 쓰지 않음: Vercel 이미지 최적화 한도를 소모하지 않도록,
  // 업로드 시점에 이미 리사이즈·WebP 변환을 끝내 둠
  img({ src, alt }) {
    if (typeof src !== 'string' || !src) return null;
    // 파일명에 담긴 크기로 비율 공간을 미리 확보 → 로딩 중 본문이 밀리지 않음
    const size = imageSizeFromUrl(src);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ''} width={size?.width} height={size?.height} loading="lazy" decoding="async" />
    );
  },

  // ```java title="CsvImporter.java" → 파일명(없으면 언어 이름) + Copy 버튼
  pre({ node, children }) {
    const code = node?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
    const classes = (code?.properties.className as string[] | undefined) ?? [];
    const lang = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length);
    const meta = (code?.data as { meta?: string } | undefined)?.meta ?? '';
    const title = meta.match(/title="([^"]+)"/)?.[1] ?? lang ?? '';
    const text = code ? textOf(code).replace(/\n$/, '') : '';
    return (
      <figure className="code">
        <figcaption>
          <span>{title}</span>
          <CopyButton text={text} label="Copy" doneLabel="Copied" className="copy" />
        </figcaption>
        <pre>{children}</pre>
      </figure>
    );
  },

  aside({ className, children, ...rest }) {
    if (!className?.includes('callout')) return <aside className={className}>{children}</aside>;
    const kind = (rest as Record<string, unknown>)['data-kind'] as string | undefined;
    return (
      <aside className="callout" data-kind={kind}>
        <InfoIcon />
        <div className="callout-body">{children}</div>
      </aside>
    );
  },

  // 외부 링크는 새 탭
  a({ href, children }) {
    const external = typeof href === 'string' && /^https?:\/\//.test(href);
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  },
};

// 본문과 목차를 함께 만듦 (Markdown은 동기 함수라 한 번 변환하면서 제목을 모을 수 있음)
export function renderMarkdown(content: string, options: { compact?: boolean } = {}) {
  const headings: Heading[] = [];
  const body = Markdown({
    children: content,
    remarkPlugins: [remarkGfm, remarkCallouts],
    rehypePlugins: [rehypeHeadings(headings)],
    components,
  });
  const element = <div className={`post-body${options.compact ? ' compact' : ''}`}>{body}</div>;
  return { element, headings };
}

export default function MarkdownView({ content, compact }: { content: string; compact?: boolean }) {
  return renderMarkdown(content, { compact }).element;
}
