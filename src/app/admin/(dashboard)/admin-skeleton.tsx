'use client';

import { usePathname } from 'next/navigation';

// 관리자 화면 로딩 스켈레톤 (상단 메뉴는 레이아웃이라 그대로 남고, 아래 내용만 바뀜)
// 공개 화면(components/route-skeleton.tsx)과 같은 이유로 도착할 주소를 보고 모양을 고름
// 관리자 화면은 매번 서버에서 로그인 확인 + DB 조회를 하므로(캐시 없음) 이동할 때마다 보일 수 있음
export default function AdminSkeleton() {
  const path = usePathname();
  const isEditor = path.startsWith('/admin/posts/');
  const isComments = path.startsWith('/admin/comments');
  const isNarrow = path.startsWith('/admin/categories') || path.startsWith('/admin/tags');

  return (
    <>
      <p role="status" className="sr-only">
        불러오는 중
      </p>
      <div aria-hidden="true" className="skel-screen">
        {isEditor ? <EditorSkeleton /> : <ListSkeleton width={isNarrow ? 'max-w-4xl' : 'max-w-5xl'} tall={isComments} />}
      </div>
    </>
  );
}

// 글 목록 / 댓글 / 카테고리 / 태그: 제목 + 테두리 있는 목록
function ListSkeleton({ width, tall }: { width: string; tall: boolean }) {
  const rows = tall ? 5 : 8;
  return (
    <section className={`mx-auto ${width}`}>
      <div className="mb-4 flex h-10 items-center justify-between">
        <span className="skel h-5 w-24" />
        {!tall && <span className="skel h-9 w-20 rounded-lg" />}
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {Array.from({ length: rows }, (_, i) =>
          tall ? (
            <li key={i} className="flex flex-col gap-2.5 px-4 py-4">
              <span className="skel h-2.5 w-56" />
              <span className="skel h-3.5 w-16" />
              <span className="skel h-3 w-[80%]" />
            </li>
          ) : (
            <li key={i} className="flex h-[50px] items-center justify-between gap-3 px-4">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="skel h-3 w-8 shrink-0" />
                <span className={`skel h-3.5 ${i % 3 === 0 ? 'w-[52%]' : i % 3 === 1 ? 'w-[38%]' : 'w-[46%]'}`} />
              </span>
              <span className="skel h-5 w-20 shrink-0 rounded-full" />
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

// 새 글 / 글 수정 (post-editor.tsx: 상단 바 → 언어 탭 + 입력칸 | 발행 설정)
function EditorSkeleton() {
  return (
    <div className="-mt-2">
      <div className="-mx-4 mb-6 flex min-h-16 items-center justify-between gap-4 border-b border-line px-4 sm:-mx-8 sm:px-8">
        <span className="flex items-center gap-4">
          <span className="skel h-3.5 w-14" />
          <span className="skel h-4 w-24" />
        </span>
        <span className="flex gap-2">
          <span className="skel h-10 w-24 rounded-[10px]" />
          <span className="skel h-10 w-20 rounded-[10px]" />
        </span>
      </div>
      <div className="flex flex-wrap items-start gap-10">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <span className="flex h-10 items-center gap-6 border-b border-line">
            <span className="skel h-3.5 w-16" />
            <span className="skel h-3.5 w-16" />
          </span>
          <span className="skel h-11 w-full rounded-[10px]" />
          <span className="skel h-[60vh] w-full rounded-[14px]" />
        </section>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5 lg:max-w-[340px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex flex-col gap-2">
              <span className="skel h-3 w-16" />
              <span className="skel h-10 w-full rounded-[10px]" />
            </span>
          ))}
        </aside>
      </div>
    </div>
  );
}
