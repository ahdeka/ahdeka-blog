import { notFound } from 'next/navigation';

// /ja/xyz 처럼 [locale] 아래에서 매칭되는 라우트가 없는 URL을 잡아서
// global-not-found(헤더 없음, 이중언어) 대신 [locale]/not-found(헤더 + 해당 언어)로 보냄
// 더 구체적인 라우트(/posts 등)가 항상 우선하므로 기존 페이지에는 영향 없음
export default function CatchAll() {
  notFound();
}
