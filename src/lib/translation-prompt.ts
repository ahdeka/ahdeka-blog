// 번역은 API 대신 claude.ai 채팅으로: 에디터가 프롬프트를 만들어 복사 → 결과를 붙여넣으면 언어별로 나눠 넣음
// 대상 언어가 늘어도(예: 영어) 프롬프트 1번 · 붙여넣기 1번으로 끝나도록 모든 언어를 한 번에 요청

import type { Locale } from '@/i18n/config';

type Text = { title: string; summary: string; content: string };

const LANGUAGE: Record<string, { name: string; style: string }> = {
  ja: {
    name: '日本語',
    style:
      '原文の文体(한다체・해요체など)にかかわらず、常にです・ます調に統一。日本のエンジニアが読んで自然な技術ブログの文体。カタカナ語より一般的なIT用語を優先し、英語のまま使われる用語(Spring Boot、API など)はそのまま。',
  },
  en: {
    name: 'English',
    style: 'Clear, natural technical-blog English. Keep sentences concise.',
  },
  ko: { name: '한국어', style: '' },
};

const marker = (locale: string) => `===${locale}===`;
const END = '===end===';

export function buildTranslationPrompt(source: Text, targets: readonly Locale[]): string {
  const langs = targets.map((l) => `- ${l}: ${LANGUAGE[l]?.name ?? l} — ${LANGUAGE[l]?.style ?? ''}`).join('\n');
  const format = targets
    .map((l) => `${marker(l)}\ntitle: (번역한 제목, 한 줄)\nsummary: (번역한 요약, 한 줄. 원문 요약이 비어 있으면 비워 둠)\n---\n(번역한 본문 Markdown)`)
    .join('\n');

  return `아래 한국어 기술 블로그 글을 다음 언어로 번역해 주세요.
${langs}

규칙
1. Markdown 구조를 그대로 유지합니다. 제목(#), 목록, 표, 인용, 빈 줄 위치를 바꾸지 마세요.
2. 이미지 줄 ![설명](URL)은 같은 위치·같은 순서로 모두 남기고, URL은 한 글자도 바꾸지 마세요. [설명] 부분만 번역합니다.
3. 코드 블록(\`\`\` … \`\`\`) 안의 코드는 바꾸지 마세요. 코드 주석만 번역해도 됩니다. 첫 줄의 title="파일명"도 그대로 둡니다.
4. 인라인 코드(\`…\`)는 백틱을 유지합니다. 안의 내용이 코드(변수·함수·클래스 이름, 명령어, 경로, 설정 키 등)면 그대로 두고, 한국어 일반 문장·단어(예: \`저장 버튼\`, \`설정 > 계정\` 같은 화면 문구)면 백틱 안의 한국어만 번역합니다.
4-1. 링크 URL, :::info 와 ::: 줄은 그대로 둡니다.
5. 내용을 덧붙이거나 줄이지 말고, 원문에 충실하게 번역합니다.
6. 답변은 아래 형식만 출력합니다. 형식 앞뒤에 설명을 붙이지 말고, 전체를 코드 블록으로 감싸지 마세요.

${format}
${END}

----- 원문 (ko) -----
title: ${source.title}
summary: ${source.summary.replace(/\s*\n\s*/g, ' ')}
---
${source.content}`;
}

export type ParsedTranslations = Partial<Record<Locale, Text>>;

// 붙여넣은 결과를 언어별로 분리. 형식이 틀리면 이유를 담아 오류
export function parseTranslationResult(raw: string, targets: readonly Locale[]): ParsedTranslations {
  let text = raw.replace(/\r\n?/g, '\n').trim();
  // 실수로 전체를 코드 블록으로 감싼 경우만 벗겨 냄 (첫 줄이 ```이고 마지막 줄이 ```)
  const wrapped = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*)\n\1\s*$/.exec(text);
  if (wrapped && wrapped[2].includes(marker(targets[0]))) text = wrapped[2].trim();

  const endAt = text.lastIndexOf(END);
  if (endAt >= 0) text = text.slice(0, endAt);

  const result: ParsedTranslations = {};
  for (const locale of targets) {
    const start = text.indexOf(`${marker(locale)}\n`);
    if (start < 0) throw new Error(`${locale.toUpperCase()} 번역이 없습니다 (${marker(locale)} 줄을 찾지 못함).`);
    let block = text.slice(start + marker(locale).length + 1);
    // 다음 언어 구분선 앞까지 (줄 맨 앞에 있는 ===xx=== 만 구분선으로 인정)
    const next = block.search(/^===[a-z]{2}===$/m);
    if (next >= 0) block = block.slice(0, next);

    const m = /^title:[ \t]*(.*)\nsummary:[ \t]*(.*)\n---\n([\s\S]*)$/.exec(block);
    if (!m) throw new Error(`${locale.toUpperCase()} 번역의 형식이 다릅니다 (title: / summary: / --- 순서여야 함).`);
    const [, title, summary, content] = m;
    if (!title.trim()) throw new Error(`${locale.toUpperCase()} 제목이 비어 있습니다.`);
    result[locale] = { title: title.trim(), summary: summary.trim(), content: content.replace(/\s+$/, '') + '\n' };
  }
  return result;
}
