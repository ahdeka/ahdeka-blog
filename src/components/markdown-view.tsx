import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Blockquote, Paragraph, PhrasingContent, Root as MdRoot, RootContent } from 'mdast';
import type { Element, ElementContent, Root as HastRoot } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { highlightCode } from '@/lib/highlight';
import { imageSizeFromUrl } from '@/lib/images/dimensions';
import CopyButton from './copy-button';
import ZoomImage from './zoom-image';

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
// 줄바꿈 한 번 = 실제 줄바꿈(<br>)
// 표준 Markdown은 Enter 한 번을 공백으로 취급해 다음 줄이 옆으로 이어 붙음 → 에디터에서 보이는 대로 나오도록 바꿈
// (문단 구분은 그대로 빈 줄 = Enter 두 번). 코드(``·```)는 text 노드가 아니라서 영향 없음
// ⚠️ remarkCallouts보다 뒤에 둘 것: 안내 박스는 text 안의 "\n" 으로 :::info / ::: 줄을 찾음
// ---------------------------------------------------------------------
type MdParent = { children: RootContent[] };

function splitBreaks(node: MdParent) {
  const out: RootContent[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && child.value.includes('\n')) {
      child.value.split('\n').forEach((part, i) => {
        if (i > 0) out.push({ type: 'break' });
        if (part) out.push({ type: 'text', value: part });
      });
    } else {
      if ('children' in child) splitBreaks(child as MdParent);
      out.push(child);
    }
  }
  node.children = out;
}

const remarkSoftBreaks = () => (tree: MdRoot) => splitBreaks(tree as MdParent);


// ---------------------------------------------------------------------
// 화면 낭독기·버튼 문구 (공개 페이지는 언어별 사전에서, 관리자 미리보기는 기본값)
// ---------------------------------------------------------------------
export type MarkdownLabels = {
  zoomImage: string; // "이미지 크게 보기"
  closeImage: string; // "닫기"
  headingLink: string; // "이 제목으로 가는 링크"
  footnotes: string; // "각주"
  footnoteBack: string; // "본문으로 돌아가기"
};

const DEFAULT_LABELS: MarkdownLabels = {
  zoomImage: '이미지 크게 보기',
  closeImage: '닫기',
  headingLink: '이 제목으로 가는 링크',
  footnotes: '각주',
  footnoteBack: '본문으로 돌아가기',
};

// ---------------------------------------------------------------------
// 제목(h2·h3)에 id를 붙이고 목차용으로 모음 + 제목 옆 "#" 링크 (마우스를 올리면 보임)
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

// class 목록 (hast는 보통 className 배열, shiki 결과는 class 문자열)
const classesOf = (el: Element | undefined): string[] =>
  [el?.properties.className, el?.properties.class].flatMap((c: unknown) =>
    Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(' ').filter(Boolean) : [],
  );

const rehypeHeadings = (collected: Heading[], labels: MarkdownLabels) => () => (tree: HastRoot) => {
  const used = new Map<string, number>();
  const walk = (node: HastRoot | ElementContent) => {
    if (node.type === 'element') {
      // 각주 영역(GFM이 자동으로 만드는 "각주" 제목 포함)은 목차·링크 대상이 아님
      if (node.tagName === 'section' && 'dataFootnotes' in node.properties) return;
      if (node.tagName === 'h2' || node.tagName === 'h3') {
        const text = textOf(node).trim();
        const base = slugify(text);
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n === 0 ? base : `${base}-${n}`;
        node.properties = { ...node.properties, id };
        node.children.push({
          type: 'element',
          tagName: 'a',
          properties: { href: `#${id}`, className: ['heading-anchor'], ariaLabel: `${labels.headingLink}: ${text}` },
          children: [{ type: 'text', value: '#' }],
        });
        collected.push({ id, text, level: node.tagName === 'h2' ? 2 : 3 });
        return;
      }
    }
    if ('children' in node) node.children.forEach((c) => walk(c as ElementContent));
  };
  walk(tree);
};

// ---------------------------------------------------------------------
// 이미지만 있는 문단 → <figure> (가운데 정렬 블록 + 캡션)
// - 캡션 = 대체 텍스트: ![캡션](주소). 비워 두면 캡션 없음
// - 줄 단위로 판단: 이미지 줄 바로 아래(빈 줄 없이)에 글을 써도 이미지 줄만 figure로 떼어 냄
// - 글과 같은 줄에 섞인 이미지(배지·아이콘)만 글자 크기로 둠
// ---------------------------------------------------------------------
const isBlank = (n: ElementContent) => n.type === 'text' && n.value.trim() === '';
const isImg = (n: ElementContent): n is Element => n.type === 'element' && n.tagName === 'img';
const isBr = (n: ElementContent) => n.type === 'element' && n.tagName === 'br';

function toFigure(img: Element): Element {
  const alt = String(img.properties.alt ?? '').trim();
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: ['post-figure'] },
    children: alt
      ? [img, { type: 'element', tagName: 'figcaption', properties: { ariaHidden: 'true' }, children: [{ type: 'text', value: alt }] }]
      : [img],
  };
}

// <p>를 <br> 기준 줄로 나눠, 이미지만 있는 줄은 figure로, 나머지 연속된 줄은 다시 <p>로 묶음
function splitParagraph(p: Element): Element[] {
  const lines: ElementContent[][] = [[]];
  for (const k of p.children) {
    if (isBr(k)) lines.push([]);
    else lines[lines.length - 1].push(k);
  }
  const out: Element[] = [];
  let buf: ElementContent[][] = [];
  const flush = () => {
    while (buf.length && buf[0].every(isBlank)) buf.shift();
    while (buf.length && buf[buf.length - 1].every(isBlank)) buf.pop();
    if (buf.length) {
      const children: ElementContent[] = [];
      buf.forEach((line, i) => {
        if (i > 0) children.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
        children.push(...line);
      });
      out.push({ ...p, children });
    }
    buf = [];
  };
  for (const line of lines) {
    const imgs = line.filter(isImg);
    if (imgs.length > 0 && line.every((k) => isBlank(k) || isImg(k))) {
      flush();
      out.push(...imgs.map(toFigure));
    } else buf.push(line);
  }
  flush();
  return out;
}

const rehypeFigures = () => (tree: HastRoot) => {
  const walk = (parent: HastRoot | Element) => {
    const out: (typeof parent.children)[number][] = [];
    for (const node of parent.children) {
      if (node.type === 'element' && node.tagName === 'p' && node.children.some(isImg)) {
        out.push(...splitParagraph(node));
        continue;
      }
      if (node.type === 'element') walk(node);
      out.push(node);
    }
    parent.children = out as typeof parent.children;
  };
  walk(tree);
};

// ---------------------------------------------------------------------
// 코드 블록 줄 옵션 (``` 뒤에 언어와 함께 적음)
//   ```java title="A.java" {3-5} ins={7} del={6} showLineNumbers
//   - {3-5}           : 강조할 줄 (쉼표로 여러 개: {1,3-5})
//   - ins={…} del={…} : 추가·삭제된 줄 (초록·빨강)
//   - showLineNumbers : 줄 번호
//   ```diff 는 + / - 로 시작하는 줄을 자동으로 추가·삭제 줄로 표시
// ---------------------------------------------------------------------
function parseLines(spec: string | undefined): Set<number> {
  const set = new Set<number>();
  for (const part of (spec ?? '').split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i - Math.min(a, b) < 10000; i++) set.add(i);
  }
  return set;
}

type LineOptions = { hl: Set<number>; ins: Set<number>; del: Set<number>; numbers: boolean; diff: boolean };

function lineOptions(meta: string, lang: string | undefined): LineOptions {
  return {
    hl: parseLines(meta.match(/(?:^|\s)\{([\d,\s-]+)\}/)?.[1]),
    ins: parseLines(meta.match(/(?:^|\s)ins=\{([\d,\s-]+)\}/)?.[1]),
    del: parseLines(meta.match(/(?:^|\s)del=\{([\d,\s-]+)\}/)?.[1]),
    numbers: /(?:^|\s)showLineNumbers(?:\s|$)/.test(meta),
    diff: lang?.toLowerCase() === 'diff',
  };
}

// shiki 결과 <code> 안의 줄(span.line)마다 상태 class를 붙이고, 줄 사이 "\n"은 뺌 (줄을 block으로 그림)
function renderHighlighted(text: string, lang: string | undefined, opts: LineOptions) {
  const tree = highlightCode(text, lang);
  const pre = tree.children.find((c): c is Element => c.type === 'element' && c.tagName === 'pre');
  const code = pre?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
  if (!code) return null;
  let n = 0;
  code.children = code.children.filter((c) => c.type === 'element');
  for (const line of code.children) {
    if (line.type !== 'element') continue;
    n++;
    const first = textOf(line)[0];
    const cls = classesOf(line);
    if (opts.hl.has(n)) cls.push('hl');
    if (opts.ins.has(n) || (opts.diff && first === '+')) cls.push('ins');
    else if (opts.del.has(n) || (opts.diff && first === '-')) cls.push('del');
    const { class: _drop, ...props } = line.properties; // eslint-disable-line @typescript-eslint/no-unused-vars
    line.properties = { ...props, className: cls };
  }
  return toJsxRuntime(code, { Fragment, jsx, jsxs });
}

// ---------------------------------------------------------------------
// 요소별 렌더링
// ---------------------------------------------------------------------
const InfoIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

function makeComponents(labels: MarkdownLabels): Components {
  return {
    // next/image는 쓰지 않음: Vercel 이미지 최적화 한도를 소모하지 않도록,
    // 업로드 시점에 이미 리사이즈·WebP 변환을 끝내 둠
    img({ src, alt }) {
      if (typeof src !== 'string' || !src) return null;
      // 파일명에 담긴 크기로 비율 공간을 미리 확보 → 로딩 중 본문이 밀리지 않음
      const size = imageSizeFromUrl(src);
      return (
        <ZoomImage
          src={src}
          alt={alt ?? ''}
          width={size?.width}
          height={size?.height}
          labels={{ zoom: labels.zoomImage, close: labels.closeImage }}
        />
      );
    },

    // ```java title="CsvImporter.java" → 파일명(없으면 언어 이름) + Copy 버튼
    pre({ node, children }) {
      const code = node?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      const lang = classesOf(code)
        .find((c) => c.startsWith('language-'))
        ?.slice('language-'.length);
      const meta = (code?.data as { meta?: string } | undefined)?.meta ?? '';
      const title = meta.match(/title="([^"]+)"/)?.[1] ?? lang ?? '';
      const text = code ? textOf(code).replace(/\n$/, '') : '';
      const opts = lineOptions(meta, lang);
      const highlighted = renderHighlighted(text, lang, opts);
      return (
        <figure className="code" data-line-numbers={opts.numbers || undefined}>
          <figcaption>
            <span>{title}</span>
            <CopyButton text={text} label="Copy" doneLabel="Copied" className="copy" />
          </figcaption>
          <pre>{highlighted ?? children}</pre>
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

    // 외부 링크는 새 탭. 나머지 속성(제목 링크 class, 각주 링크의 data-*·aria-*)은 그대로 전달
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    a({ node, href, children, ...rest }) {
      const external = typeof href === 'string' && /^https?:\/\//.test(href);
      return (
        <a href={href} {...rest} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {children}
        </a>
      );
    },
  };
}

// 본문과 목차를 함께 만듦 (Markdown은 동기 함수라 한 번 변환하면서 제목을 모을 수 있음)
export function renderMarkdown(content: string, options: { compact?: boolean; labels?: MarkdownLabels } = {}) {
  const labels = options.labels ?? DEFAULT_LABELS;
  const headings: Heading[] = [];
  const body = Markdown({
    children: content,
    remarkPlugins: [remarkGfm, remarkCallouts, remarkSoftBreaks],
    remarkRehypeOptions: { footnoteLabel: labels.footnotes, footnoteBackLabel: labels.footnoteBack },
    rehypePlugins: [rehypeHeadings(headings, labels), rehypeFigures],
    components: makeComponents(labels),
  });
  const element = <div className={`post-body${options.compact ? ' compact' : ''}`}>{body}</div>;
  return { element, headings };
}

export default function MarkdownView({ content, compact, labels }: { content: string; compact?: boolean; labels?: MarkdownLabels }) {
  return renderMarkdown(content, { compact, labels }).element;
}
