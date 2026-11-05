// 업로드한 이미지는 파일명에 원래 크기를 담아 둠: {uuid}_{가로}x{세로}.webp
// → DB 없이도 렌더링 시 width/height를 지정할 수 있어 로딩 중 레이아웃 밀림(CLS)이 없음
// 서버(공개 페이지)와 클라이언트(에디터 미리보기) 양쪽에서 사용
const SIZE_IN_NAME = /_([1-9]\d{0,4})x([1-9]\d{0,4})\.webp(?:$|[?#])/;

export function imageSizeFromUrl(url: string): { width: number; height: number } | null {
  const m = SIZE_IN_NAME.exec(url);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

export function imageFileName(id: string, width: number, height: number) {
  return `${id}_${width}x${height}.webp`;
}
