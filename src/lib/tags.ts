// 태그 규칙 (에디터 · 서버 저장 · 관리 화면 공용). DB 제약(0007)과 같음
// 이름은 영문 하나를 KO/JA 공통으로 씀. 주소(slug)는 이름에서 자동 생성하되 바꿀 수 있음

export const MAX_TAGS_PER_POST = 10;
export const TAG_NAME_MAX = 30;
export const TAG_SLUG_MAX = 50;

const NAME_RE = /^[A-Za-z0-9 .#+-]+$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type TagInput = { name: string; slug: string };

// 앞뒤 공백 제거 + 연속 공백을 하나로
export const normalizeTagName = (v: string) => v.trim().replace(/\s+/g, ' ');

export function tagNameError(name: string): string | null {
  if (!name) return '태그 이름을 입력하세요.';
  if (name.length > TAG_NAME_MAX) return `태그 이름은 ${TAG_NAME_MAX}자 이내로 입력하세요.`;
  if (!NAME_RE.test(name) || !/[A-Za-z0-9]/.test(name)) {
    return '태그 이름은 영문·숫자와 공백 . # + - 만 쓸 수 있어요.';
  }
  return null;
}

export function tagSlugError(slug: string): string | null {
  if (!SLUG_RE.test(slug) || slug.length > TAG_SLUG_MAX) {
    return `태그 주소(slug)는 영어 소문자·숫자·하이픈으로 ${TAG_SLUG_MAX}자 이내여야 합니다.`;
  }
  return null;
}

export const isTagSlug = (v: string) => SLUG_RE.test(v) && v.length <= TAG_SLUG_MAX;

// 이름 → 주소 제안: C# → csharp, C++ → cpp, Node.js → node-js, Spring Boot → spring-boot
export function suggestTagSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/#/g, 'sharp')
    .replace(/\+/g, 'p')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, TAG_SLUG_MAX)
    .replace(/^-+|-+$/g, '');
}
