// 에디터 본문에 넣는 "업로드 중" 자리표시자
// 업로드가 끝나면 이 문자열 그대로를 찾아 실제 이미지로 교체하므로, 위치 계산이 필요 없음
// uploading: 은 실제 URL 스킴이 아니라서 미리보기(react-markdown)에서는 src가 비워져 이미지가 표시되지 않음
const PREFIX = '![업로드 중…](uploading:';
const PLACEHOLDER_RE = /!\[[^\]]*\]\(uploading:[0-9a-f]{8}\)/;

export function uploadPlaceholder(uuid: string) {
  return `${PREFIX}${uuid.slice(0, 8)})`;
}

export function hasPlaceholder(content: string) {
  return PLACEHOLDER_RE.test(content);
}

// 업로드 실패 시: 자리표시자와 함께 넣었던 빈 줄 하나도 같이 제거
export function removePlaceholder(content: string, token: string) {
  const i = content.indexOf(token);
  if (i < 0) return content;
  let start = i;
  let end = i + token.length;
  if (content.startsWith('\n\n', end)) end += 2;
  else if (start >= 2 && content.startsWith('\n\n', start - 2)) start -= 2;
  return content.slice(0, start) + content.slice(end);
}
