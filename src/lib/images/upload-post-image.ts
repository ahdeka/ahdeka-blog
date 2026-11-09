'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { imageFileName } from './dimensions';

// 본문 칼럼(~720px)의 2배 밀도까지 커버. 세로로 긴 스크린샷은 높이도 제한
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 4800;
const QUALITY = 0.82;
const MAX_INPUT_BYTES = 30 * 1024 * 1024; // 브라우저 메모리 보호
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 버킷 상한(0003)과 동일
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export const ACCEPT_ATTR = ACCEPTED.join(',');

export type UploadedImage = { url: string; width: number; height: number };

// 브라우저에서 리사이즈 + WebP 변환
// - Vercel 함수를 거치지 않으므로 실행 시간·요청 크기 제한과 무관
// - canvas로 다시 그리기 때문에 EXIF(촬영 위치 GPS 등) 메타데이터가 자동으로 제거됨
async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  // 휴대폰 사진의 회전 정보(EXIF orientation)를 반영해서 읽음
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지를 처리할 수 없습니다.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
    // WebP 인코딩을 지원하지 않는 브라우저는 PNG로 돌려줌 → 버킷이 거부하므로 미리 안내
    if (!blob || blob.type !== 'image/webp') {
      throw new Error('이 브라우저는 WebP 변환을 지원하지 않습니다. 최신 Chrome / Edge / Firefox를 사용하세요.');
    }
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

export async function uploadPostImage(file: File): Promise<UploadedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error('JPEG, PNG, WebP 이미지만 올릴 수 있습니다.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('원본 이미지가 너무 큽니다 (30MB 이하).');

  const { blob, width, height } = await toWebp(file);
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error('변환 후에도 2MB를 넘습니다. 더 작은 이미지를 사용하세요.');

  // 경로 형식은 RLS(0003)에서 다시 검사함. 원본 파일명은 쓰지 않음 (개인정보·특수문자 방지)
  const path = `${new Date().getFullYear()}/${imageFileName(crypto.randomUUID(), width, height)}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from('post-images').upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000', // 이름이 매번 새로우니 1년 캐시해도 안전
    upsert: false,
  });
  if (error) throw new Error(`업로드 실패: ${error.message}`);

  // 아직 어느 글에도 속하지 않은 업로드로 기록 (글을 저장하면 그 글 소속이 됨)
  // → 저장하지 않고 버린 이미지를 나중에 버킷에서 정리할 수 있음
  // 실패해도 저장할 때 다시 등록되므로 업로드 자체는 성공으로 처리
  const { error: recordError } = await supabase.from('post_images').insert({ path });
  if (recordError) console.warn('[images] post_images insert failed', recordError.message);

  const { data } = supabase.storage.from('post-images').getPublicUrl(path);
  return { url: data.publicUrl, width, height };
}
