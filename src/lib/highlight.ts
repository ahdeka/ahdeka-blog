import { createHighlighterCoreSync, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import type { Root } from 'hast';
import githubDark from '@shikijs/themes/github-dark-default';
import java from '@shikijs/langs/java';
import kotlin from '@shikijs/langs/kotlin';
import groovy from '@shikijs/langs/groovy';
import sql from '@shikijs/langs/sql';
import xml from '@shikijs/langs/xml';
import yaml from '@shikijs/langs/yaml';
import json from '@shikijs/langs/json';
import properties from '@shikijs/langs/properties';
import ini from '@shikijs/langs/ini';
import toml from '@shikijs/langs/toml';
import shellscript from '@shikijs/langs/shellscript';
import dockerfile from '@shikijs/langs/dockerfile';
import diff from '@shikijs/langs/diff';
import javascript from '@shikijs/langs/javascript';
import typescript from '@shikijs/langs/typescript';
import jsx from '@shikijs/langs/jsx';
import tsx from '@shikijs/langs/tsx';
import html from '@shikijs/langs/html';
import css from '@shikijs/langs/css';
import python from '@shikijs/langs/python';

// 코드 블록 색 입히기 (shiki)
// - react-markdown이 동기 렌더링이라 동기 하이라이터 + JS 정규식 엔진(WASM 없음)을 씀
// - 공개 페이지는 서버에서 색을 입혀 HTML로 보냄 → 방문자 쪽 JS 증가 없음
// - 관리자 미리보기(클라이언트)에서도 같은 코드로 동작
// - 코드 블록은 테마와 관계없이 항상 어두운 배경이라 다크 테마 하나만 씀
// 새 언어가 필요하면 위 import와 LANGS에 추가 (```bash, ```ts 같은 별칭은 자동 인식)
const THEME = 'github-dark-default';
const LANGS = [
  java, kotlin, groovy, sql, xml, yaml, json, properties, ini, toml,
  shellscript, dockerfile, diff, javascript, typescript, jsx, tsx, html, css, python,
].flat();

let highlighter: HighlighterCore | undefined;
function getHighlighter() {
  highlighter ??= createHighlighterCoreSync({
    themes: [githubDark],
    langs: LANGS,
    // 일부 정규식을 JS로 못 옮기는 문법이 있어도 에러 대신 그 부분만 색 없이 둠
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighter;
}

// 지원하지 않는 언어(또는 언어 없음)면 'text'(색 없음)로 → 어떤 코드 블록이든 줄 단위 구조(span.line)가 생김
// (줄 강조·줄 번호가 언어와 관계없이 동작하도록)
export function highlightCode(code: string, lang: string | undefined): Root {
  const hl = getHighlighter();
  const resolved = lang ? hl.resolveLangAlias(lang.toLowerCase()) : '';
  const known = resolved !== '' && hl.getLoadedLanguages().includes(resolved);
  return hl.codeToHast(code, { lang: known ? resolved : 'text', theme: THEME });
}
