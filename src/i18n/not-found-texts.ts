import type { Locale } from './config';

// 404 문구만 따로 둠: not-found는 클라이언트 컴포넌트라, 사전 JSON 전체를 import하면 번들에 통째로 들어감
// global-not-found에서도 같이 사용 (문구를 한 곳에서 관리)
export const notFoundTexts: Record<Locale, { title: string; body: string; back: string }> = {
  ja: {
    title: 'ページが見つかりません',
    body: 'お探しのページは削除されたか、URLが変更された可能性があります。',
    back: 'トップへ戻る',
  },
  ko: {
    title: '페이지를 찾을 수 없습니다',
    body: '찾으시는 페이지가 삭제되었거나 주소가 바뀌었을 수 있습니다.',
    back: '홈으로 돌아가기',
  },
};
