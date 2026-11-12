import { notFound } from 'next/navigation';

// /ja/xyz 처럼 [locale] 아래에서 매칭되는 라우트가 없는 URL을 잡아서
// global-not-found(헤더 없음, 이중언어) 대신 [locale]/not-found(헤더 + 해당 언어)로 보냄
// 더 구체적인 라우트(/posts 등)가 항상 우선하므로 기존 페이지에는 영향 없음

// 다른 공개 화면처럼 첫 요청 때 렌더링 → 캐시 (ISR)
// ⚠️ 지우지 말 것: 요청마다 렌더링(동적)이면 [locale]/loading.tsx 때문에 응답이 스트리밍으로 먼저 시작되어
//    상태 코드가 404가 아니라 200(+ noindex)이 됨. ISR은 다 그린 뒤 보내므로 404가 그대로 유지됨
export function generateStaticParams() {
  return [];
}

export default function CatchAll() {
  notFound();
}
