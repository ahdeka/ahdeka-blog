// 이 블로그 전용 Markdown 확장 (렌더러 markdown-view.tsx · 에디터 markdown-keys.ts · 발췌 excerpt.ts 공용)
//
// 1) 글자색:  {red}색을 입힐 글{/}
//    - 색은 아래 TEXT_COLORS만 (라이트·다크 모드 각각 읽기 좋은 값으로 globals.css에서 지정)
//    - 안에 굵게·기울임·코드·링크를 섞어도 됨. 단, 여는 기호와 닫는 기호는 같은 서식 안에 있어야 함
//      (O: {red}**굵게**{/}, **{red}굵게{/}**   X: {red}**굵게{/}**)
//    - 짝이 맞지 않는 기호는 그대로 글자로 보임 (작성 중인 글이 깨져 보이지 않도록)
//    - 코드(`…`, ``` … ```) 안의 {red}는 글자 그대로
// 2) 빈 줄: 표준 Markdown은 빈 줄이 몇 개든 문단 구분 한 번으로 합침
//    → 빈 줄 1개 = 지금처럼 문단 구분, 2개째부터는 하나당 한 줄 높이의 빈 공간
import type { Emphasis, Paragraph, Root, RootContent } from 'mdast';

export const TEXT_COLORS = ['red', 'blue', 'teal', 'gray'] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export const COLOR_CLOSE = '{/}';
export const colorOpen = (c: TextColor) => `{${c}}`;

const COLOR_NAMES = TEXT_COLORS.join('|');
// 여는 기호 {red} 또는 닫는 기호 {/}. 1번 그룹 = 색 이름 (닫는 기호면 undefined)
export const colorTokenRe = () => new RegExp(`\\{(?:(${COLOR_NAMES})|/)\\}`, 'g');

export const stripColorTokens = (s: string) => s.replace(colorTokenRe(), '');

// ---------------------------------------------------------------------
// 글자색 → <span class="tc tc-red">
// ---------------------------------------------------------------------
type Parent = { children: RootContent[] };
type OpenMark = { color: TextColor; at: number };

function colorize(parent: Parent) {
  const out: RootContent[] = [];
  const stack: OpenMark[] = [];

  for (const child of parent.children) {
    if (child.type !== 'text') {
      if ('children' in child) colorize(child as Parent);
      out.push(child);
      continue;
    }
    const re = colorTokenRe();
    let last = 0;
    for (let m = re.exec(child.value); m; m = re.exec(child.value)) {
      if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) });
      last = m.index + m[0].length;
      if (m[1]) {
        // 짝을 못 찾으면 그대로 글자로 남도록, 일단 글자로 넣어 두고 위치만 기억
        stack.push({ color: m[1] as TextColor, at: out.length });
        out.push({ type: 'text', value: m[0] });
        continue;
      }
      const open = stack.pop();
      if (!open) {
        out.push({ type: 'text', value: m[0] });
        continue;
      }
      const inner = out.splice(open.at).slice(1); // 맨 앞 = 여는 기호 글자
      out.push({
        type: 'emphasis',
        data: { hName: 'span', hProperties: { className: ['tc', `tc-${open.color}`] } },
        children: inner,
      } as Emphasis);
    }
    if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
  }
  parent.children = out;
}

export const remarkTextColors = () => (tree: Root) => colorize(tree as Parent);

// ---------------------------------------------------------------------
// 연속된 빈 줄 → 빈 공간 (<div class="blank-line">)
// - 원문 줄 번호(position)로 블록 사이 빈 줄 수를 셈
// - 최상위·인용·안내 박스 안에서만 (목록 안에 넣으면 <li> 구조가 깨짐)
// - 참조 링크 정의·각주 정의는 화면에 그 자리에 나오지 않으므로 계산에서 뺌
// ---------------------------------------------------------------------
const INVISIBLE = new Set(['definition', 'footnoteDefinition']);

const blankLine = (): Paragraph => ({
  type: 'paragraph',
  data: { hName: 'div', hProperties: { className: ['blank-line'], ariaHidden: 'true' } },
  children: [],
});

function addBlankLines(parent: Parent) {
  const out: RootContent[] = [];
  let prev: RootContent | undefined;
  for (const child of parent.children) {
    if (child.type === 'blockquote') addBlankLines(child as Parent);
    if (INVISIBLE.has(child.type)) {
      out.push(child);
      continue;
    }
    const gap = prev?.position && child.position ? child.position.start.line - prev.position.end.line - 1 : 0;
    for (let i = 1; i < gap; i++) out.push(blankLine());
    out.push(child);
    prev = child;
  }
  parent.children = out;
}

export const remarkBlankLines = () => (tree: Root) => addBlankLines(tree as Parent);
