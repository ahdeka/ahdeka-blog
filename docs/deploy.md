# 배포 절차 (Vercel + Supabase)

처음 배포할 때 한 번 진행하고, 나중에 DB를 새로 만들 때(재구축·이전)도 이 순서를 그대로 따른다.

- 환경 구성: **Production** = prod Supabase · 실제 도메인 / **Preview** = dev Supabase(`ahdeka-blog-dev`) / **로컬** = dev Supabase
- 리전: Supabase Tokyo(ap-northeast-1) ↔ Vercel Functions `hnd1` (vercel.json)

## 1. prod Supabase 프로젝트

1. 새 프로젝트 생성: 이름 `ahdeka-blog`, Region **Tokyo**, DB 비밀번호는 비밀번호 관리자에 보관
2. SQL Editor에서 `supabase/migrations/0001` ~ `0010`을 **번호 순서대로** 하나씩 실행 (빈 DB에서 순서대로 적용되는 것 확인됨)
   - `supabase/seed/`는 **실행하지 않음** (dev 전용)
3. 관리자 등록 (0001 끝의 [수동 작업])
   1. Authentication → Users → Add user 로 본인 계정 생성
   2. Authentication → Sign In / Providers 에서 신규 가입(Allow new users) 끄기
   3. SQL Editor:
      ```sql
      insert into public.admins (user_id)
      select id from auth.users where email = '본인 이메일';
      ```
   4. 배포 후 `/admin/login`에서 로그인 → TOTP(MFA) 등록 (등록 전에는 글쓰기가 막히는 것이 정상)
4. Authentication → URL Configuration
   - Site URL: `https://blog.ahdeka.dev`
   - Redirect URLs: `https://blog.ahdeka.dev/**`
5. Storage: `post-images` 버킷이 0001로 만들어졌는지 확인 (public)

## 2. Cloudflare Turnstile

- 운영용 위젯을 따로 만들고 Hostname에 `blog.ahdeka.dev` 등록 → 사이트 키·비밀 키 발급
- 서버는 Production에서 토큰의 hostname이 `NEXT_PUBLIC_SITE_URL`과 같은지 검사함
- Production에 테스트 키를 넣으면 댓글 등록이 전부 거부됨 (의도된 fail closed)

## 3. Vercel 프로젝트

1. GitHub `ahdeka/ahdeka-blog` 가져오기 (Framework: Next.js, 설정 기본값)
   - 가져오기 화면의 Environment Variables 칸에 **Production 값을 먼저 넣고** Deploy
   - 빈 상태로 배포하면 빌드가 `supabaseUrl is required`로 실패함 (빌드 때 홈 화면을 미리 만들면서 DB를 읽기 때문)
2. Environment Variables (`.env.example` 참고). Settings → Environment Variables 에서 환경별로 지정

   | 변수 | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://blog.ahdeka.dev` | 비워 둠 (배포 주소 사용) |
   | `NEXT_PUBLIC_SUPABASE_URL` / `..._PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` | prod 프로젝트 값 | dev 프로젝트 값 |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 운영 위젯 키 | 테스트 키 가능 |
   | `COMMENT_IP_HASH_SECRET` | 새로 생성 | dev와 같은 값 가능 |

   `NEXT_PUBLIC_*`는 빌드 때 코드에 박히므로, 값을 바꾸면 **재배포**해야 반영됨
3. Domains: `blog.ahdeka.dev` 추가 → 안내된 CNAME 레코드를 Cloudflare DNS에 등록
   - Proxy status는 **DNS only(회색 구름)**. 주황 구름(프록시)이면 Cloudflare·Vercel CDN이 겹쳐 SSL 발급·캐시가 꼬일 수 있음
   - `.dev`는 HTTPS 전용 도메인(HSTS preload). Vercel이 인증서를 자동 발급하므로 추가 작업 없음
4. 첫 배포 후 확인
   - `/ko`, `/ja`, 글 상세, 검색, `/ko/rss.xml`, `/sitemap.xml`, `/robots.txt`
   - 글 작성 → 공개 화면 즉시 반영(revalidate) / 이미지 업로드
   - 댓글 등록(Turnstile) · 15분 내 삭제 / 관리자 답글
   - 공유 카드: OG 이미지 (https://www.opengraph.xyz 등)

## 4. 배포 후

- Google Search Console · 네이버 서치어드바이저: 사이트 등록 → `https://blog.ahdeka.dev/sitemap.xml` 제출
- 백업: Supabase 무료 플랜은 백업 다운로드 불가 → 별도 백업 방법 마련 (DB dump + Storage)
- 이후 DB 변경: 새 마이그레이션 파일을 **dev에 먼저** 적용·확인 → prod에 적용 → 앱 배포 (DB가 앱보다 먼저)
