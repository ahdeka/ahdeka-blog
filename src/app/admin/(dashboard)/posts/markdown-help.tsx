// 에디터 툴바의 "?" 패널: 버튼이 없는 Markdown 문법 + 이 블로그 전용 문법 + 단축키 모음
// 문법을 추가·변경하면(markdown-view.tsx, markdown-keys.ts) 여기도 같이 고칠 것

type Row = { syntax: string; desc: string };

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: '기본 문법',
    rows: [
      { syntax: '> 내용', desc: '인용' },
      { syntax: '1. 내용', desc: '번호 목록' },
      { syntax: '- [ ] 할 일', desc: '체크리스트 (- [x] = 완료)' },
      { syntax: '~~내용~~', desc: '취소선' },
      { syntax: '---', desc: '구분선 (위아래 빈 줄)' },
      { syntax: '![캡션](주소)', desc: '이미지 (대괄호 안 글자 = 캡션)' },
      { syntax: '본문[^1]\n\n[^1]: 설명', desc: '각주 (글 맨 아래에 모아서 표시)' },
      { syntax: '| :--- | :---: | ---: |', desc: '표 칸 정렬 (왼쪽·가운데·오른쪽)' },
    ],
  },
  {
    title: '이 블로그 전용',
    rows: [
      { syntax: ':::info\n내용\n:::', desc: '안내 박스 (:::warn = 주의)' },
      { syntax: '```java title="A.java"', desc: '코드 블록 위에 파일명 표시' },
      { syntax: '```java {3-5}', desc: '줄 강조 (여러 개: {1,3-5})' },
      { syntax: '```java ins={7} del={6}', desc: '추가·삭제된 줄 (초록·빨강)' },
      { syntax: '```java showLineNumbers', desc: '줄 번호' },
      { syntax: '```diff', desc: '+ / - 로 시작하는 줄을 자동으로 추가·삭제 표시' },
    ],
  },
  {
    title: '단축키',
    rows: [
      { syntax: 'Ctrl+B · I · E · K', desc: '굵게 · 기울임 · 인라인 코드 · 링크 (다시 누르면 해제)' },
      { syntax: 'Ctrl+S', desc: '저장 후 계속 작성' },
      { syntax: 'Enter', desc: '목록·인용 이어쓰기 (빈 항목에서 Enter = 목록 끝)' },
      { syntax: 'Tab · Shift+Tab', desc: '목록 들여쓰기·내어쓰기, 코드 블록 안에선 2칸 들여쓰기' },
      { syntax: 'Esc → Tab', desc: '입력창에서 다음 칸으로 이동' },
    ],
  },
];

export default function MarkdownHelp() {
  return (
    <div id="markdown-help" className="grid gap-x-8 gap-y-4 border-b border-line bg-subtle px-4 py-3.5 md:grid-cols-2 xl:grid-cols-3">
      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h3 className="text-[12.5px] font-semibold text-fg-3">{g.title}</h3>
          <dl className="flex flex-col gap-1.5">
            {g.rows.map((r) => (
              <div key={r.syntax} className="flex items-baseline gap-3 text-[13px]">
                <dt className="mono shrink-0 basis-[46%] rounded-md bg-bg px-1.5 py-0.5 text-[12px] whitespace-pre-wrap break-all text-fg">
                  {r.syntax}
                </dt>
                <dd className="text-fg-2">{r.desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
