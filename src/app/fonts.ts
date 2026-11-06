import { IBM_Plex_Sans_JP, IBM_Plex_Sans_KR, JetBrains_Mono } from 'next/font/google';

// 디자인 시안과 같은 글꼴. 빌드 시 내려받아 이 사이트에서 직접 제공 (Google로 요청이 나가지 않음)
// 한·일 글꼴은 글자 범위별로 잘게 나뉘어 있어 화면에 쓰인 글자 조각만 받음 → preload는 끔
const kr = IBM_Plex_Sans_KR({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  preload: false,
  variable: '--font-kr',
});

const jp = IBM_Plex_Sans_JP({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  preload: false,
  variable: '--font-jp',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// <html className={fontVariables}> → globals.css에서 var(--font-kr) 등으로 사용
export const fontVariables = `${kr.variable} ${jp.variable} ${mono.variable}`;
