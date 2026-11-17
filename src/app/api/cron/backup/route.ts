import { runBackup } from '@/lib/backup/run-backup';

// Vercel Cron(vercel.json)이 매일 호출 → DB·이미지를 비공개 GitHub 저장소에 백업
// - Vercel은 CRON_SECRET 환경변수가 있으면 Authorization: Bearer <CRON_SECRET> 을 붙여 호출함
// - Cron은 Production 배포에서만 실행됨
// - 덤: 매일 DB를 읽으므로 무료 플랜 prod 프로젝트가 비활성으로 일시정지되는 것도 막음

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIME_BUDGET_MS = 40_000; // 남은 이미지는 다음 날 이어서 올림

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const repo = process.env.BACKUP_GITHUB_REPO;
  const token = process.env.BACKUP_GITHUB_TOKEN;
  if (!secret || !repo || !token) {
    console.error('[backup] CRON_SECRET / BACKUP_GITHUB_REPO / BACKUP_GITHUB_TOKEN not set');
    return Response.json({ error: 'not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runBackup({ repo, token, deadline: Date.now() + TIME_BUDGET_MS });
    console.log('[backup] done', JSON.stringify(result));
    return Response.json(result);
  } catch (e) {
    console.error('[backup] failed', e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
