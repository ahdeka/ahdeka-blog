import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { AUTHOR_AVATAR, AUTHOR_NAME, AUTHOR_NICKNAME, CONTACT_EMAIL, GITHUB_URL } from '@/lib/site';

// next/image는 쓰지 않음: 이미 320px WebP로 줄여 둔 정적 파일이라 최적화가 필요 없음
export function AuthorAvatar({ size }: { size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={AUTHOR_AVATAR} alt={AUTHOR_NAME} width={size} height={size} className="avatar object-cover" style={{ width: size, height: size }} />
  );
}

const GithubIcon = () => (
  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </svg>
);

const MailIcon = () => (
  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

// GitHub · 메일 아이콘 버튼 (사이드바·소개 페이지 공용)
export function ProfileLinks({ small }: { small?: boolean }) {
  const cls = small ? 'icon-btn size-9' : 'icon-btn';
  return (
    <div className="flex gap-2">
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className={cls}>
        <GithubIcon />
      </a>
      <a href={`mailto:${CONTACT_EMAIL}`} aria-label="Email" title={CONTACT_EMAIL} className={cls}>
        <MailIcon />
      </a>
    </div>
  );
}

// 목록 왼쪽 사이드바의 프로필
export function ProfileSidebar({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <AuthorAvatar size={48} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="text-base font-bold">{AUTHOR_NICKNAME[locale]}</strong>
          <span className="mono text-xs text-fg-3">@{AUTHOR_NAME}</span>
        </div>
      </div>
      <p className="text-[13px] leading-[1.7] whitespace-pre-line text-fg-2">{dict.profile.bio}</p>
      <ProfileLinks small />
    </section>
  );
}
