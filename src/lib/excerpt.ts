// 본문 Markdown → 목록·OG·RSS용 짧은 발췌 (요약을 비워 둔 글에 대신 쓰임)
// 저장할 때 한 번 계산해 post_translations.excerpt에 넣음 → 목록 조회 때 본문 전체를 가져오지 않음
// 코드·이미지·표·제목 줄은 빼고 "읽히는 문장"만 남김

export const EXCERPT_LENGTH = 160;

const FENCE_RE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;

export function makeExcerpt(markdown: string, max = EXCERPT_LENGTH): string | null {
  const text = markdown
    .replace(/\r\n?/g, '\n')
    .replace(FENCE_RE, '\n') // 코드 블록
    .replace(/<!--[\s\S]*?-->/g, '') // HTML 주석
    .split('\n')
    .filter((line) => {
      const l = line.trim();
      if (/^#{1,6}\s/.test(l)) return false; // 제목 줄 (본문 첫머리가 "## 개요" 같은 경우가 많음)
      if (l.startsWith('|')) return false; // 표
      if (/^([-*_])(\s*\1){2,}$/.test(l)) return false; // 구분선
      if (/^\[[^\]]+\]:\s/.test(l)) return false; // 참조 링크 정의
      return true;
    })
    .map((line) =>
      line
        .replace(/^\s*>+\s?/, '') // 인용
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, ''), // 목록·체크박스
    )
    .join('\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크 → 글자만
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1') // 참조 링크
    .replace(/<\/?[a-zA-Z][^>]*>/g, '') // HTML 태그
    .replace(/`+([^`]*)`+/g, '$1') // 인라인 코드
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2') // 굵게·취소선
    .replace(/(^|[^\w*_])([*_])(?!\s)([^*_\n]+?)\2(?!\w)/g, '$1$3') // 기울임 (snake_case의 _는 앞뒤가 글자라 그대로)
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;
  const chars = Array.from(text); // 이모지 등 서로게이트 쌍이 잘리지 않도록
  if (chars.length <= max) return text;
  return chars.slice(0, max).join('').trimEnd() + '…';
}
