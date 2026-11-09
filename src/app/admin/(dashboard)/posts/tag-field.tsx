'use client';

import { useState } from 'react';
import {
  MAX_TAGS_PER_POST,
  normalizeTagName,
  suggestTagSlug,
  TAG_NAME_MAX,
  TAG_SLUG_MAX,
  tagNameError,
  tagSlugError,
  type TagInput,
} from '@/lib/tags';

type Props = {
  value: TagInput[];
  options: TagInput[]; // 기존 태그 (자동완성)
  onChange: (tags: TagInput[]) => void;
  onError: (message: string) => void;
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// 태그 입력: Enter·쉼표로 추가, 빈 칸에서 Backspace로 마지막 태그 삭제
// 기존 태그와 대소문자만 다르면 기존 태그로 붙음. 새 태그는 주소(slug)를 확인·수정할 수 있음
export default function TagField({ value, options, onChange, onError }: Props) {
  const [text, setText] = useState('');
  const isNew = (t: TagInput) => !options.some((o) => same(o.name, t.name));
  const newTags = value.filter(isNew);

  // 여러 개를 한 번에 (붙여넣은 "Spring, JPA") → 한 번만 onChange. 돌려주는 값 = 넣지 못한 이름
  function add(raws: string[]): string {
    let next = value;
    const rejected: string[] = [];
    for (const raw of raws) {
      const name = normalizeTagName(raw);
      if (!name || next.some((t) => same(t.name, name))) continue;
      const invalid = tagNameError(name) ?? (next.length >= MAX_TAGS_PER_POST ? `태그는 ${MAX_TAGS_PER_POST}개까지 달 수 있어요.` : null);
      if (invalid) {
        onError(invalid);
        rejected.push(name);
        continue;
      }
      next = [...next, options.find((o) => same(o.name, name)) ?? { name, slug: suggestTagSlug(name) }];
    }
    if (next !== value) onChange(next);
    return rejected.join(', ');
  }

  function remove(name: string) {
    onChange(value.filter((t) => t.name !== name));
  }

  function setSlug(name: string, slug: string) {
    onChange(value.map((t) => (t.name === name ? { ...t, slug: slug.toLowerCase() } : t)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="lbl">
        태그 <span className="mono font-normal text-fg-3">{value.length}/{MAX_TAGS_PER_POST}</span>
        <span className="font-normal text-fg-3"> · 영문 이름 하나를 KO/JA 공통으로 써요</span>
      </span>

      {/* .field는 높이가 고정(44px)이라 칩이 여러 줄이 되면 넘침 → 테두리만 있는 field-box로 높이를 내용에 맞춤 */}
      <div className="field-box flex min-h-10 flex-wrap items-center gap-1.5 rounded-[10px] px-2 py-1.5">
        {value.map((t) => (
          <span key={t.name} className="inline-flex h-7 items-center gap-1 rounded-md bg-subtle pr-1 pl-2 text-[13px] font-medium">
            {t.name}
            {isNew(t) && <span className="text-[11px] font-semibold text-accent-fg">새</span>}
            <button
              type="button"
              aria-label={`${t.name} 태그 빼기`}
              onClick={() => remove(t.name)}
              className="grid size-5 place-items-center rounded text-fg-3 hover:bg-bg hover:text-fg"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-fg-3"
          list="tag-options"
          value={text}
          maxLength={TAG_NAME_MAX + 5}
          placeholder={value.length ? '' : 'Spring, JPA, C# … Enter로 추가'}
          aria-label="태그 추가"
          disabled={value.length >= MAX_TAGS_PER_POST}
          onChange={(e) => {
            // 쉼표를 치면 바로 추가 (붙여넣은 "Spring, JPA"도 나눠서)
            const v = e.target.value;
            if (!v.includes(',')) return setText(v);
            const parts = v.split(',');
            const rest = parts.pop() ?? '';
            add(parts); // 잘못된 이름은 오류 메시지로 안내
            setText(rest);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              setText(add([text]));
            } else if (e.key === 'Backspace' && !text && value.length) {
              remove(value[value.length - 1].name);
            }
          }}
        />
        <datalist id="tag-options">
          {options
            .filter((o) => !value.some((t) => same(t.name, o.name)))
            .map((o) => (
              <option key={o.slug} value={o.name} />
            ))}
        </datalist>
      </div>

      {newTags.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-subtle px-3 py-2.5">
          <span className="text-[12.5px] text-fg-3">새 태그는 저장할 때 만들어져요. 주소를 확인하세요.</span>
          {newTags.map((t) => {
            const invalid = tagSlugError(t.slug);
            return (
              <label key={t.name} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 truncate font-medium">{t.name}</span>
                  <span className="mono text-fg-3">/tag/</span>
                  <input
                    className="field mono h-8 min-w-0 flex-1 px-2 text-[13px]"
                    value={t.slug}
                    maxLength={TAG_SLUG_MAX}
                    aria-label={`${t.name} 태그 주소`}
                    onChange={(e) => setSlug(t.name, e.target.value)}
                  />
                </span>
                {invalid && <span className="text-xs text-danger">{invalid}</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
