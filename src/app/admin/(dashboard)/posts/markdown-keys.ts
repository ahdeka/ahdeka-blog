// 본문(Markdown) 입력창의 편집 보조 (post-editor.tsx)
// - 값을 바꾸는 계산은 전부 순수 함수: (본문, 선택 시작, 선택 끝) → 새 본문 + 새 선택 영역 (테스트 가능)
// - 실제 입력창 반영은 applyToTextarea (브라우저 실행 취소 기록을 유지)
//
// 동작 기준은 Notion: 같은 단축키를 다시 누르면 해제, 빈 항목에서 Enter = 목록 끝,
// 기호 바로 뒤에서 Backspace = 일반 문장으로, Tab/Shift+Tab = 목록 들여쓰기·내어쓰기

export type Edit = { value: string; start: number; end: number };
export type EditFn = (value: string, start: number, end: number) => Edit;

// 목록 줄: 들여쓰기 + (- * + 또는 1. 1)) + 공백 + (선택) 체크박스
const LIST_LINE = /^([ \t]*)(?:([-*+])|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/;
// 인용 줄: "> ", "> > " …
const QUOTE_LINE = /^[ \t]*(?:>[ \t]?)+/;
// 서식을 적용하지 않을 줄 앞부분 (제목·인용·목록 기호)
const LINE_PREFIX = /^[ \t]*(?:#{1,6}[ \t]+|(?:>[ \t]?)+)?(?:(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?/;
const FENCE = /^[ \t]*(```|~~~)/gm;
const UNIT = 2; // 코드 블록·여러 줄 들여쓰기 칸 수

const lineStartOf = (v: string, pos: number) => v.lastIndexOf('\n', pos - 1) + 1;
const lineEndOf = (v: string, pos: number) => {
  const i = v.indexOf('\n', pos);
  return i === -1 ? v.length : i;
};

// 커서가 코드 블록(``` … ```) 안인지: 그 앞의 펜스 줄 개수가 홀수면 안쪽
function inCodeBlock(v: string, lineStart: number) {
  return (v.slice(0, lineStart).match(FENCE)?.length ?? 0) % 2 === 1;
}

const indentWidth = (line: string) => line.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length;
const setIndent = (line: string, n: number) => ' '.repeat(Math.max(0, n)) + line.replace(/^[ \t]*/, '');

// ---------------------------------------------------------------------
// 여러 군데를 한 번에 고치는 도구: 원래 본문 기준 위치로 편집 목록을 만들고 한꺼번에 반영
// ---------------------------------------------------------------------
type Splice = { pos: number; del: number; ins: string };

function applySplices(v: string, splices: Splice[]) {
  let out = v;
  for (const sp of [...splices].sort((a, b) => b.pos - a.pos)) out = out.slice(0, sp.pos) + sp.ins + out.slice(sp.pos + sp.del);
  return out;
}

// 원래 위치 → 편집 후 위치. 같은 자리에 끼워 넣은 글자는 side='start'면 앞쪽(포함 X), 'end'면 뒤쪽으로 봄
function mapPos(p: number, splices: Splice[], side: 'start' | 'end') {
  let out = p;
  for (const sp of splices) {
    const delEnd = sp.pos + sp.del;
    if (delEnd < p || (delEnd === p && (sp.del > 0 || side === 'start'))) out += sp.ins.length - sp.del;
    else if (sp.pos < p) out -= p - sp.pos; // 지운 범위 안에 있던 위치 → 지운 자리로
  }
  return out;
}

// ---------------------------------------------------------------------
// 서식 켜기/끄기 (굵게 **, 기울임 *, 코드 `)
// - 선택한 글이 이미 그 서식이면 해제, 아니면 적용 (같은 단축키 = 토글)
// - 기호가 선택 범위 안에 있든(**글** 전체 선택) 바로 바깥에 있든(글만 선택) 모두 인식
// - 선택 양끝 공백은 기호 밖으로 (`**글 **`은 Markdown에서 굵게가 안 됨)
// - 여러 줄 선택: 줄마다 따로 (줄 앞의 목록 기호·제목 # 은 제외)
// - * 하나 = 기울임, ** = 굵게, *** = 둘 다 → 굵게를 끌 때 기울임은 남김
// ---------------------------------------------------------------------
type Mark = { ch: string; width: number; active: (run: number) => boolean };
const BOLD_MARK: Mark = { ch: '*', width: 2, active: (n) => n === 2 || n === 3 };
const ITALIC_MARK: Mark = { ch: '*', width: 1, active: (n) => n === 1 || n === 3 };
const CODE_MARK: Mark = { ch: '`', width: 1, active: (n) => n === 1 };

const runBefore = (v: string, pos: number, ch: string) => {
  let n = 0;
  while (pos - n - 1 >= 0 && v[pos - n - 1] === ch) n++;
  return n;
};
const runAfter = (v: string, pos: number, ch: string) => {
  let n = 0;
  while (pos + n < v.length && v[pos + n] === ch) n++;
  return n;
};

type Seg = { s: number; e: number };

// 선택 범위를 줄 단위 조각으로 (공백·줄 앞 기호 제외)
function segmentsOf(v: string, s: number, e: number): Seg[] {
  if (s === e) return [{ s, e }];
  const segs: Seg[] = [];
  let ls = lineStartOf(v, s);
  while (ls <= e) {
    const le = lineEndOf(v, ls);
    const line = v.slice(ls, le);
    const prefix = line.match(LINE_PREFIX)![0].length;
    let a = Math.max(s, ls + (s <= ls ? prefix : 0));
    let b = Math.min(e, le);
    while (a < b && /\s/.test(v[a])) a++;
    while (b > a && /\s/.test(v[b - 1])) b--;
    if (a < b) segs.push({ s: a, e: b });
    if (le >= v.length) break;
    ls = le + 1;
  }
  return segs.length ? segs : [{ s, e }];
}

// 조각에 그 서식이 이미 있는지: 선택 양끝에 걸친 기호 묶음(선택 안·밖 모두)을 보고 판단
// 있으면 기호를 뺀 실제 글자 범위를, 없으면 null
// (예: **글** 에서 "글"만 선택 / "**글**" 전체 선택 / 여러 줄 선택 중 "글**"처럼 한쪽만 걸친 경우 모두 인식)
function markedContent(v: string, seg: Seg, m: Mark): Seg | null {
  const inLead = Math.min(runAfter(v, seg.s, m.ch), seg.e - seg.s);
  const left = runBefore(v, seg.s, m.ch) + inLead;
  const inTail = runBefore(v, seg.e, m.ch);
  const right = inTail + runAfter(v, seg.e, m.ch);
  const content = { s: seg.s + inLead, e: seg.e - inTail };
  if (content.s >= content.e && seg.s !== seg.e) return null; // 기호만 선택한 경우
  if (seg.s === seg.e) content.s = content.e = seg.s;
  return m.active(Math.min(left, right)) ? content : null;
}

export const toggleMark =
  (m: Mark, placeholder: string): EditFn =>
  (v, s, e) => {
    const marker = m.ch.repeat(m.width);
    // 선택이 없고 서식 안에 있지도 않으면 예시 글자를 넣고 선택
    if (s === e && !markedContent(v, { s, e }, m)) {
      const value = v.slice(0, s) + marker + placeholder + marker + v.slice(e);
      return { value, start: s + m.width, end: s + m.width + placeholder.length };
    }
    const segs = segmentsOf(v, s, e);
    const contents = segs.map((g) => markedContent(v, g, m));
    const splices: Splice[] = [];
    let range: Seg[];
    if (contents.every(Boolean)) {
      // 모두 이미 적용됨 → 해제 (글자에 가장 가까운 기호부터 뺌)
      range = contents as Seg[];
      for (const c of range) splices.push({ pos: c.s - m.width, del: m.width, ins: '' }, { pos: c.e, del: m.width, ins: '' });
    } else {
      // 일부만 적용 → 안 된 조각만 적용 (Notion과 같음: 섞여 있으면 먼저 "전부 적용")
      range = segs;
      segs.forEach((g, i) => {
        if (!contents[i]) splices.push({ pos: g.s, del: 0, ins: marker }, { pos: g.e, del: 0, ins: marker });
      });
    }
    const value = applySplices(v, splices);
    return { value, start: mapPos(range[0].s, splices, 'start'), end: mapPos(range[range.length - 1].e, splices, 'end') };
  };

export const toggleBold = toggleMark(BOLD_MARK, '굵은 글씨');
export const toggleItalic = toggleMark(ITALIC_MARK, '기울임');
export const toggleCode = toggleMark(CODE_MARK, 'code');

// 링크: 링크 글자를 선택(또는 [글](주소) 전체 선택)한 상태면 링크 해제, 아니면 [글](https://) 넣고 주소 선택
export const toggleLink: EditFn = (v, s, e) => {
  const whole = v.slice(s, e).match(/^\[([^\]\n]*)\]\([^)\n]*\)$/);
  if (whole) {
    const value = v.slice(0, s) + whole[1] + v.slice(e);
    return { value, start: s, end: s + whole[1].length };
  }
  const tail = v.slice(e).match(/^\]\([^)\n]*\)/);
  if (s > 0 && v[s - 1] === '[' && tail && !v.slice(s, e).includes('\n')) {
    const value = v.slice(0, s - 1) + v.slice(s, e) + v.slice(e + tail[0].length);
    return { value, start: s - 1, end: e - 1 };
  }
  let a = s;
  let b = e;
  while (a < b && /\s/.test(v[a])) a++;
  while (b > a && /\s/.test(v[b - 1])) b--;
  const text = v.slice(a, b) || '링크 텍스트';
  const inserted = `[${text}](https://)`;
  const urlStart = a + text.length + 3;
  return { value: v.slice(0, a) + inserted + v.slice(b), start: urlStart, end: urlStart + 'https://'.length };
};

// ---------------------------------------------------------------------
// 목록 줄 들여쓰기 계산
// - 들여쓰기: 바로 위 같은 깊이 항목의 "내용 위치"까지 (Markdown 하위 목록 규칙: "- " 아래 2칸, "1. " 아래 3칸)
// - 내어쓰기: 위쪽에서 더 얕은 항목의 위치까지
// ---------------------------------------------------------------------
function* linesAbove(v: string, ls: number) {
  let pos = ls;
  while (pos > 0) {
    const start = lineStartOf(v, pos - 1);
    const line = v.slice(start, pos - 1);
    pos = start;
    if (line.trim() === '') return; // 빈 줄 = 목록 끝
    yield line;
  }
}

function listIndentTarget(v: string, ls: number, current: number, outdent: boolean): number {
  for (const line of linesAbove(v, ls)) {
    const m = line.match(LIST_LINE);
    if (!m) continue;
    const indent = indentWidth(line);
    if (outdent) {
      if (indent < current) return indent;
    } else if (indent <= current) {
      const content = indent + m[0].length - m[1].length - (m[6]?.length ?? 0);
      return content > current ? content : current;
    }
  }
  return outdent ? 0 : current; // 맨 첫 항목은 더 들여 쓸 부모가 없음
}

// 번호 목록이 새 깊이로 옮겨 가면 번호를 그 깊이에 맞게 (첫 항목이면 1, 앞 항목이 있으면 다음 번호)
function renumber(v: string, ls: number, line: string): string {
  const m = line.match(LIST_LINE);
  if (!m?.[3]) return line;
  const indent = indentWidth(line);
  let next = 1;
  for (const above of linesAbove(v, ls)) {
    const a = above.match(LIST_LINE);
    if (!a) continue;
    const ai = indentWidth(above);
    if (ai < indent) break;
    if (ai === indent) {
      next = a[3] ? Number(a[3]) + 1 : 1;
      break;
    }
  }
  return line.replace(/^([ \t]*)\d{1,9}/, `$1${next}`);
}

// ---------------------------------------------------------------------
// Tab / Shift+Tab
// - 목록 줄(여러 줄 선택 포함): 하위 목록으로 / 상위로. 번호는 새 깊이에 맞게 다시 매김
// - 코드 블록 안: 공백 2칸 들여쓰기·내어쓰기 (코드 작성용)
// - 일반 문장: 아무 변화 없음 (Markdown에는 문단 들여쓰기가 없고, 공백 4칸이 되면 코드 블록이 되어 버림)
// ---------------------------------------------------------------------
export function indentLines(v: string, start: number, end: number, outdent: boolean): Edit {
  const ls = lineStartOf(v, start);
  const le = lineEndOf(v, end > start && v[end - 1] === '\n' ? end - 1 : end);
  const lines = v.slice(ls, le).split('\n');
  const code = inCodeBlock(v, ls);

  if (code) {
    if (lines.length === 1 && !outdent) {
      const pad = ' '.repeat(UNIT);
      const value = v.slice(0, start) + pad + v.slice(end);
      return { value, start: start + pad.length, end: end + pad.length };
    }
  } else if (!lines.some((l) => LIST_LINE.test(l))) {
    return { value: v, start, end };
  }

  // 목록: 첫 목록 줄의 이동 칸 수를 선택한 모든 줄에 똑같이 (하위 구조 유지)
  let delta = 0;
  if (!code) {
    let offset = ls;
    for (const line of lines) {
      if (LIST_LINE.test(line)) {
        const cur = indentWidth(line);
        delta = listIndentTarget(v, offset, cur, outdent) - cur;
        break;
      }
      offset += line.length + 1;
    }
    if (delta === 0) return { value: v, start, end };
  }

  let offset = ls;
  let firstListDone = false;
  const next = lines.map((line) => {
    const lineStart = offset;
    offset += line.length + 1;
    if (line.trim() === '') return line;
    const cur = indentWidth(line);
    let out = code ? setIndent(line, outdent ? cur - UNIT : cur + UNIT) : setIndent(line, cur + delta);
    if (!code && !firstListDone && LIST_LINE.test(line)) {
      firstListDone = true;
      // 새 깊이에서의 번호 계산은 바뀐 본문 기준이 아니라도 위쪽 줄은 그대로라 원본으로 충분
      out = renumber(v, lineStart, out);
    }
    return out;
  });

  const block = next.join('\n');
  const value = v.slice(0, ls) + block + v.slice(le);
  if (lines.length > 1) return { value, start: ls, end: ls + block.length };
  // 한 줄: 커서는 같은 글자 위에 머물도록 늘어난(줄어든) 만큼 이동
  const shift = next[0].length - lines[0].length;
  const keep = (p: number) => Math.max(ls, p + shift);
  return { value, start: keep(start), end: keep(end) };
}

// 바로 위 덩어리(빈 줄 전까지)가 목록·인용이면, 그 아래 줄은 빈 줄 없이는 목록 안의 내용으로 붙어 버림
function attachesToBlockAbove(v: string, ls: number) {
  for (const line of linesAbove(v, ls)) if (LIST_LINE.test(line) || QUOTE_LINE.test(line)) return true;
  return false;
}

// 목록·인용 기호를 지우고 일반 문장으로 (필요하면 위에 빈 줄을 넣어 목록에서 떼어 냄)
function toParagraph(v: string, ls: number, prefixLen: number): Edit {
  const le = lineEndOf(v, ls);
  const text = v.slice(ls + prefixLen, le);
  const gap = attachesToBlockAbove(v, ls) ? '\n' : '';
  const value = v.slice(0, ls) + gap + text + v.slice(le);
  const pos = ls + gap.length;
  return { value, start: pos, end: pos };
}

// ---------------------------------------------------------------------
// Enter: 목록·인용 자동 이어쓰기
// - "- 항목|" → 다음 줄에 "- " (번호 +1, 체크박스는 빈 칸)
// - 빈 항목에서 Enter → 하위 항목이면 한 단계 위로, 맨 위 단계면 목록을 끝내고 일반 문장으로
// - 코드 블록 안, 범위 선택 중, 커서가 기호 앞이면 null (평소 Enter)
// ---------------------------------------------------------------------
export function continueBlock(v: string, start: number, end: number): Edit | null {
  if (start !== end) return null;
  const ls = lineStartOf(v, start);
  if (inCodeBlock(v, ls)) return null;
  const line = v.slice(ls, lineEndOf(v, start));

  const list = line.match(LIST_LINE);
  const quote = list ? null : line.match(QUOTE_LINE);
  const prefix = list?.[0] ?? quote?.[0];
  if (!prefix || start < ls + prefix.length) return null;

  if (line.slice(prefix.length).trim() === '') {
    if (list && indentWidth(line) > 0) {
      const out = indentLines(v, start, end, true);
      if (out.value !== v) return out;
    }
    return toParagraph(v, ls, prefix.length);
  }

  let next = prefix;
  if (list) {
    const [, indent, bullet, num, delim, space, box] = list;
    next = indent + (bullet ?? `${Number(num) + 1}${delim}`) + space + (box ? '[ ] ' : '');
  }
  const insert = `\n${next}`;
  const value = v.slice(0, start) + insert + v.slice(end);
  const pos = start + insert.length;
  return { value, start: pos, end: pos };
}

// ---------------------------------------------------------------------
// Backspace: 커서가 목록·인용 기호 바로 뒤일 때 기호를 한 번에 지움
// - 하위 항목이면 기호만 지움 (위 항목에 딸린 문장이 됨)
// - 맨 위 단계면 일반 문장으로 (위 목록에 붙지 않도록 빈 줄 확보)
// ---------------------------------------------------------------------
export function removeBlockMarker(v: string, start: number, end: number): Edit | null {
  if (start !== end) return null;
  const ls = lineStartOf(v, start);
  if (inCodeBlock(v, ls)) return null;
  const line = v.slice(ls, lineEndOf(v, start));
  const prefix = (line.match(LIST_LINE) ?? line.match(QUOTE_LINE))?.[0];
  if (!prefix || start !== ls + prefix.length) return null;

  const indent = indentWidth(line);
  if (indent > 0 && LIST_LINE.test(line)) {
    const keep = line.match(/^[ \t]*/)![0].length;
    const value = v.slice(0, ls + keep) + v.slice(ls + prefix.length);
    return { value, start: ls + keep, end: ls + keep };
  }
  return toParagraph(v, ls, prefix.length);
}

// ---------------------------------------------------------------------
// 키 → 편집 (입력창 onKeyDown에서 사용). 처리할 키가 아니면 null
// ---------------------------------------------------------------------
export type KeyInfo = { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean };

export function editForKey(k: KeyInfo, v: string, s: number, e: number): Edit | null {
  const mod = k.ctrl || k.meta;
  if (mod && !k.alt && !k.shift) {
    const fn = { b: toggleBold, i: toggleItalic, k: toggleLink, e: toggleCode }[k.key.toLowerCase()];
    return fn ? fn(v, s, e) : null;
  }
  if (mod || k.alt) return null;
  if (k.key === 'Enter' && !k.shift) return continueBlock(v, s, e);
  if (k.key === 'Backspace' && !k.shift) return removeBlockMarker(v, s, e);
  if (k.key === 'Tab') return indentLines(v, s, e, k.shift);
  return null;
}

// ---------------------------------------------------------------------
// 입력창에 반영: 바뀐 부분만 execCommand('insertText')로 넣어 Ctrl+Z로 되돌릴 수 있게 함
// (value를 직접 바꾸면 브라우저의 실행 취소 기록이 끊김)
// 지원하지 않는 환경이면 false → 호출한 쪽에서 상태를 직접 바꿈
// ---------------------------------------------------------------------
export function applyToTextarea(el: HTMLTextAreaElement, next: Edit): boolean {
  const old = el.value;
  el.focus();
  if (old !== next.value) {
    let a = 0;
    while (a < old.length && a < next.value.length && old[a] === next.value[a]) a++;
    let b = 0;
    while (b < old.length - a && b < next.value.length - a && old[old.length - 1 - b] === next.value[next.value.length - 1 - b]) b++;
    const inserted = next.value.slice(a, next.value.length - b);
    el.setSelectionRange(a, old.length - b);
    // execCommand는 표준에서 폐기 예정이지만, 입력창 실행 취소 기록을 남기는 다른 방법이 없음
    const ok = inserted ? document.execCommand('insertText', false, inserted) : document.execCommand('delete');
    if (!ok || el.value !== next.value) return false;
  }
  el.setSelectionRange(next.start, next.end);
  return true;
}
