'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { suggestTagSlug, TAG_NAME_MAX, TAG_SLUG_MAX } from '@/lib/tags';
import { deleteTag, updateTag } from './actions';

export type TagRow = { id: number; name: string; slug: string; postCount: number };

export default function TagManager({ rows }: { rows: TagRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  function remove(row: TagRow) {
    const note = row.postCount ? `\n\n글 ${row.postCount}개(초안 포함)에서 이 태그가 빠집니다.` : '';
    if (!confirm(`「${row.name}」 태그를 삭제할까요?${note}`)) return;
    run(() => deleteTag(row.id));
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">태그</h2>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
        {rows.map((row) =>
          editing === row.id ? (
            <li key={row.id} className="bg-subtle p-4">
              <TagForm
                initial={row}
                pending={isPending}
                onCancel={() => setEditing(null)}
                onSubmit={(input) => run(() => updateTag(row.id, input), () => setEditing(null))}
              />
            </li>
          ) : (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="font-semibold">{row.name}</span>
                <span className="mono truncate text-xs text-fg-3">/tag/{row.slug}</span>
              </div>
              <span className="mono text-xs text-fg-3">글 {row.postCount}</span>
              <div className="flex items-center gap-1 text-[13px]">
                <button type="button" className="px-2 py-1 font-semibold text-fg-2 hover:text-fg" onClick={() => { setEditing(row.id); setError(null); }}>
                  수정
                </button>
                <button type="button" className="px-2 py-1 font-semibold text-danger hover:underline disabled:opacity-40" disabled={isPending} onClick={() => remove(row)}>
                  삭제
                </button>
              </div>
            </li>
          ),
        )}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-fg-3">태그가 없습니다. 글 에디터에서 태그를 달면 여기에 생겨요.</li>}
      </ul>
      <p className="mt-3 text-[12.5px] text-fg-3">
        태그는 글 에디터에서 만들어요. 이름은 영문 하나를 KO/JA 공통으로 쓰고, 대소문자만 다르면 같은 태그예요. 글에 붙은 태그도 삭제할 수 있어요 (글에서 빠짐).
      </p>
    </section>
  );
}

function TagForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: TagRow;
  pending: boolean;
  onSubmit: (input: { name: string; slug: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const slugChanged = slug.trim().toLowerCase() !== initial.slug;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, slug });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="lbl">
          이름 <span className="font-normal text-fg-3">· 영문·숫자와 공백 . # + -</span>
        </span>
        <input className="field h-10 text-sm" value={name} maxLength={TAG_NAME_MAX} required autoFocus onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl flex justify-between">
          <span>
            주소 (slug) <span className="font-normal text-fg-3">· 영어 소문자·숫자·하이픈</span>
          </span>
          <button type="button" className="font-normal text-accent-fg hover:underline" onClick={() => setSlug(suggestTagSlug(name))}>
            이름에서 만들기
          </button>
        </span>
        <input
          className="field mono h-10 text-sm"
          value={slug}
          maxLength={TAG_SLUG_MAX}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
        />
        {slugChanged && <span className="text-xs text-warn">주소가 바뀌면 기존 /tag/{initial.slug} 링크는 열리지 않아요.</span>}
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn-accent" disabled={pending}>
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}
