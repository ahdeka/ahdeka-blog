import type { Dictionary } from '@/i18n/get-dictionary';
import { AUTHOR_NAME, GITHUB_URL } from '@/lib/site';

// 프로필 사진 대신 이름 첫 글자 (사진을 쓰게 되면 이 컴포넌트만 바꾸면 됨)
export function AuthorAvatar({ size }: { size: number }) {
  return (
    <div
      role="img"
      aria-label={AUTHOR_NAME}
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.37) }}
    >
      {AUTHOR_NAME.charAt(0).toUpperCase()}
    </div>
  );
}

const GithubIcon = () => (
  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </svg>
);

// 목록 왼쪽 사이드바의 프로필
export function ProfileSidebar({ dict }: { dict: Dictionary }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <AuthorAvatar size={60} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="text-[17px] font-bold">{AUTHOR_NAME}</strong>
          <span className="mono text-[12.5px] text-fg-3">@{AUTHOR_NAME}</span>
        </div>
      </div>
      <p className="text-sm leading-[1.7] text-fg-2">{dict.profile.bio}</p>
      <div className="flex gap-2">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="icon-btn">
          <GithubIcon />
        </a>
      </div>
    </section>
  );
}

