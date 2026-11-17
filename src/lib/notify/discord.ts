import 'server-only';

// 운영자 알림: 디스코드 채널 웹훅 (DISCORD_WEBHOOK_URL)
// - 환경변수가 없으면 아무것도 하지 않음 (로컬·Preview는 기본적으로 알림 없음)
// - 알림 실패는 로그만 남기고 삼킴 → 댓글 작성·백업 결과에 영향 없음
// - allowed_mentions: 방문자 댓글에 @everyone 등이 있어도 멘션이 울리지 않게

export type DiscordEmbed = {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

// 디스코드 제한: title 256, description 4096, field value 1024 → 여유 있게 자름
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function notifyDiscord(embed: DiscordEmbed): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      cache: 'no-store',
    });
    if (!res.ok) console.error('[notify] discord', res.status, (await res.text().catch(() => '')).slice(0, 300));
  } catch (err) {
    console.error('[notify] discord failed', err);
  }
}
