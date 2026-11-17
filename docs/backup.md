# 백업 · 복구

Supabase 무료 플랜은 백업 파일을 내려받을 수 없음 → **Vercel Cron이 매일 DB와 이미지를 비공개 GitHub 저장소에 커밋**한다.
Supabase·Vercel 어느 쪽에 문제가 생겨도 백업은 GitHub에 남는다.

- 실행: 매일 03시 무렵(KST) `GET /api/cron/backup` (`vercel.json`, `0 18 * * *` UTC — Hobby 플랜은 그 1시간 안 어느 시점)
- 저장 위치
  - `db/<table>.json`: 테이블 전체 (기본 키 순 정렬, 보기 좋게 줄바꿈 → 변경분이 diff로 보임)
  - `images/<yyyy>/<file>.webp`: `post-images` 버킷 원본
- 바뀐 파일이 없으면 커밋하지 않음 → **커밋 이력 = 날짜별 백업**. 특정 날짜로 되돌리려면 그 커밋을 체크아웃하면 됨
- 이미지는 저장소에 없는 것만 올림. 블로그에서 지운 이미지도 백업에서는 지우지 않음
- 한 번에 40초 안에 다 못 올린 이미지는 다음 날 이어서 올림 (응답의 `pendingImages`)
- 제외: `comment_secrets`(IP 해시·삭제 토큰 해시 — 복구에 필요 없음), `auth.users`(관리자 계정은 복구 때 새로 만듦)
- 덤: 매일 DB를 읽으므로 무료 플랜 prod 프로젝트가 비활성으로 일시정지되는 것도 막음

## 설정 (한 번만)

1. GitHub에서 **비공개** 저장소 생성 (예: `ahdeka/blog-backup`)
   - **Add a README file 체크** (빈 저장소는 API로 커밋할 수 없음)
2. GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token
   - Repository access: **Only select repositories** → 백업 저장소 하나만
   - Permissions → Repository → **Contents: Read and write** (나머지는 없음)
   - 만료일: 최대(1년) — 만료되면 백업이 멈추므로 달력에 갱신일을 적어 둘 것
3. Vercel → Settings → Environment Variables (**Production만**. Cron은 Production 배포에서만 실행됨)

   | 변수 | 값 |
   |---|---|
   | `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `BACKUP_GITHUB_REPO` | `ahdeka/blog-backup` |
   | `BACKUP_GITHUB_TOKEN` | 2에서 발급한 토큰 |

4. 배포 후 Vercel → Settings → Cron Jobs 에서 `/api/cron/backup` 이 보이는지 확인 → **Run** 으로 바로 한 번 실행
   → 백업 저장소에 `backup: YYYY-MM-DD (...)` 커밋이 생기면 성공
   - 실패하면 Vercel → Logs 에서 `[backup]` 검색

### 직접 실행 (로컬에서 확인할 때)

`.env.local`에 세 값을 넣고 `npm run dev` 후:

```sh
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/backup
```

로컬은 dev DB를 읽으므로, 확인용으로는 **테스트용 저장소**를 따로 쓰는 것을 권장 (prod 백업 이력에 dev 데이터가 섞이지 않게).

## 복구

새 Supabase 프로젝트(또는 비운 DB)에 되살리는 순서. 기존 데이터가 있는 DB에 그대로 실행하면 기본 키 충돌로 실패한다.

1. [deploy.md](deploy.md) 1번대로 마이그레이션 0001~마지막 적용, 관리자 계정 생성 (admins insert는 아래 SQL이 함)
2. 백업 저장소 clone (특정 날짜가 필요하면 그 커밋 checkout)
3. 복구 SQL 생성 → SQL Editor에 붙여넣어 실행
   ```sh
   node scripts/backup-to-sql.mjs ../blog-backup > restore.sql
   ```
   - 트리거·외래 키 검사를 끄고(`session_replication_role = replica`) 넣은 뒤 identity 시퀀스를 맞춤
   - 관리자 계정 id가 바뀌었으면 `admins` 행을 새 id로 고칠 것: `update public.admins set user_id = (select id from auth.users where email = '본인 이메일');`
   - SQL이 너무 커서 SQL Editor가 버거우면 `psql "<connection string>" -f restore.sql`
4. 이미지: Supabase → Storage → `post-images` 버킷에 백업의 `images/` 안 연도 폴더(`2026/` …)를 그대로 업로드
   - 글 본문의 이미지 URL에 **프로젝트 주소가 들어 있음** → 다른 프로젝트로 옮겼다면 주소 치환 필요
     ```sql
     update public.post_translations
        set content = replace(content, 'https://<옛 ref>.supabase.co', 'https://<새 ref>.supabase.co');
     ```
5. 앱 환경변수를 새 프로젝트 값으로 바꾸고 재배포
