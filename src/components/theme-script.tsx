// 페이지가 그려지기 전에 테마를 정해서 깜빡임(흰 화면 → 다크)을 막음
// 저장된 선택이 없으면 OS 설정을 따름. ISR 캐시와 무관하게 브라우저에서만 결정됨
//
// ⚠️ next/script(beforeInteractive)로 바꾸지 말 것: 인라인 스크립트는 대기열(self.__next_s)에 들어가
//    첫 화면을 그린 뒤에 실행됨 → 다크 모드 사용자에게 흰 화면이 번쩍임
// ⚠️ 이 스크립트가 들어 있는 루트 레이아웃([locale])이 클라이언트에서 다시 마운트되면
//    React가 "Encountered a script tag" 경고를 냄 → 언어 전환 링크는 전체 페이지 이동(<a>)으로 처리
export const THEME_KEY = 'theme';

const script = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
