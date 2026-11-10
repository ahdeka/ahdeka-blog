'use client';

import { useCallback, useId, useRef, useState, useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { createComment } from '@/lib/comments/actions';
import { BODY_MAX, NICKNAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/comments/rules';
import Turnstile from './turnstile';

type Props = {
  postId: string;
  locale: Locale;
  dict: Dictionary['comments'];
  parentId?: string; // 있으면 답글 폼
  replyToName?: string; // 답글 대상 닉네임 ("○○ 님에게 답글")
  onCancel?: () => void;
  onPosted?: () => void;
};

const NICKNAME_KEY = 'comment-nickname';

// 닉네임만 브라우저에 기억 (비밀번호는 절대 저장하지 않음)
function readSavedNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

// 입력 박스 1개: 본문 textarea + (포커스 시) 하단 바에 닉네임·비밀번호·작성 버튼
export default function CommentForm({ postId, locale, dict, parentId, replyToName, onCancel, onPosted }: Props) {
  const id = useId();
  const isReply = Boolean(parentId);
  // 답글 폼은 클릭 후 브라우저에서만 그려지므로 바로 읽어도 됨. 하단 폼은 서버 렌더링이라 첫 포커스 때 채움
  const [nickname, setNickname] = useState(() => (isReply ? readSavedNickname() : ''));
  const [password, setPassword] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState(''); // 봇 함정 (사람에게는 보이지 않음)
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  // 처음 포커스될 때 Turnstile을 불러옴 → 글만 읽는 방문자는 추가 로딩 없음 (한 번 켜지면 유지)
  const [active, setActive] = useState(isReply);
  // 박스 안에 포커스가 있는지 → 하단 바 표시 여부
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 답글 폼은 항상 펼침. 하단 폼은 포커스 중이거나 본문을 쓰는 중이면 펼침
  // (본문 조건: 작성 버튼을 누르는 순간 blur가 나도 바가 사라져 클릭이 유실되지 않도록)
  const expanded = isReply || focused || body.trim().length > 0;

  function handleFocus() {
    setFocused(true);
    if (active) return;
    setActive(true);
    if (!nickname) setNickname(readSavedNickname());
  }

  // 포커스가 박스 밖으로 완전히 나갈 때만 접음 (닉네임·비밀번호 칸으로 이동하면 유지)
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }

  // 박스의 빈 여백을 눌러도 textarea로 포커스 (입력 요소·버튼 클릭은 그대로)
  function focusOnDeadZone(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, label')) return;
    e.preventDefault();
    textareaRef.current?.focus();
  }

  const onToken = useCallback((t: string | null) => setToken(t), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setMessage({ type: 'error', text: dict.captchaRequired });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await createComment({ postId, parentId, nickname, body, password, website, turnstileToken: token });
      // 토큰은 1회용이므로 성공·실패와 관계없이 위젯을 새로 만듦
      setToken(null);
      setWidgetKey((k) => k + 1);

      if (!res.ok) {
        setMessage({ type: 'error', text: dict.errors[res.code] });
        return;
      }
      try {
        localStorage.setItem(NICKNAME_KEY, nickname.trim());
      } catch {}
      setBody('');
      setPassword('');
      setMessage({ type: 'ok', text: dict.posted });
      onPosted?.();
    });
  }

  return (
    <form onSubmit={submit}>
      {isReply && replyToName && (
        <span className="mb-2.5 block text-[13px] text-fg-3">
          {/* "{name} 님에게 답글" → 이름 부분만 굵게 */}
          {dict.replyTo.split('{name}').map((part, i) => (
            <span key={i}>
              {i > 0 && <strong className="text-fg-2">{replyToName}</strong>}
              {part}
            </span>
          ))}
        </span>
      )}

      <div onFocus={handleFocus} onBlur={handleBlur} onMouseDown={focusOnDeadZone} className="field-box overflow-hidden">
        <textarea
          ref={textareaRef}
          id={`${id}-body`}
          className="area resize-none"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (message?.type === 'error') setMessage(null);
          }}
          placeholder={isReply ? dict.replyPlaceholder : dict.bodyPlaceholder}
          aria-label={dict.body}
          maxLength={BODY_MAX}
          rows={3}
          required
        />

        {/* 하단 바는 항상 자리를 차지하고 보이기만 토글 → 포커스해도 높이가 그대로라 페이지가 흔들리지 않음
            invisible 상태에서는 클릭·Tab 이동 대상에서도 빠짐 */}
        <div
          className={`flex flex-wrap items-center gap-2 border-t px-3 py-2.5 transition-opacity ${
            expanded ? 'border-line opacity-100' : 'invisible border-transparent opacity-0'
          }`}
        >
          <IconField icon={<UserIcon />}>
            <input
              id={`${id}-nickname`}
              className={smallField}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={dict.nicknamePlaceholder}
              aria-label={dict.nickname}
              maxLength={NICKNAME_MAX}
              autoComplete="nickname"
              required
            />
          </IconField>
          <IconField icon={<LockIcon />}>
            <input
              id={`${id}-password`}
              type="password"
              className={smallField}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={dict.password}
              aria-label={dict.password}
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              // 브라우저가 이 사이트의 다른 비밀번호를 자동 입력하거나 저장 제안하지 않도록
              autoComplete="new-password"
              required
            />
          </IconField>
          <div className="ml-auto flex gap-2">
              {onCancel && (
                <button type="button" onClick={onCancel} className="btn btn-ghost h-9 px-3.5 text-[13.5px]">
                  {dict.cancel}
                </button>
              )}
            <button type="submit" disabled={isPending} className="btn btn-primary h-9 px-4 text-[13.5px]">
              {isPending ? dict.submitting : isReply ? dict.replySubmit : dict.submit}
            </button>
          </div>
        </div>
      </div>

      {/* 봇 함정: 스크린 리더·키보드 이동에서도 제외 */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      </div>

      {active && (
        <Turnstile key={widgetKey} action="comment" language={locale} onToken={onToken} unavailableText={dict.captchaUnavailable} />
      )}

      {/* 알림 영역은 항상 두어야 화면 낭독기가 바뀐 내용을 읽어 줌 */}
      <p role="status" className={`mt-2.5 text-sm empty:hidden ${message?.type === 'error' ? 'text-danger' : 'text-accent-fg'}`}>
        {message?.text}
      </p>
    </form>
  );
}

const smallField = 'field h-9 w-full min-w-0 pl-8 pr-3 text-[13.5px]';

// 입력칸 왼쪽 안쪽에 아이콘 (클릭은 input으로 통과)
function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-40 sm:flex-none">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3">{icon}</span>
      {children}
    </div>
  );
}

const UserIcon = () => (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);

const LockIcon = () => (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
