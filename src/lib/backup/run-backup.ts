import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { GitHubRepo, gitBlobSha } from './github';

// 매일 백업: DB 테이블 → db/<table>.json, Storage 이미지 → images/<path>
// - 내용이 바뀐 파일만 커밋 (바뀐 게 없으면 커밋하지 않음)
// - 이미지는 저장소에 없는 것만 올림. 블로그에서 지운 이미지도 백업에서는 지우지 않음
// - comment_secrets(IP 해시·삭제 토큰 해시)는 복구에 필요 없고 민감해서 제외
// 복구 절차: docs/backup.md

const BUCKET = 'post-images';

// 복구할 때 넣는 순서 (외래 키 의존 순서)
const TABLES: { name: string; order: string[] }[] = [
  { name: 'admins', order: ['user_id'] },
  { name: 'categories', order: ['id'] },
  { name: 'tags', order: ['id'] },
  { name: 'posts', order: ['id'] },
  { name: 'post_translations', order: ['id'] },
  { name: 'post_tags', order: ['post_id', 'tag_id'] },
  { name: 'post_images', order: ['path'] },
  { name: 'post_stats', order: ['post_id'] },
  { name: 'comments', order: ['id'] },
];

const PAGE = 1000; // PostgREST 기본 최대 행 수
const IMAGE_CONCURRENCY = 4;

export type BackupResult = {
  commit: string | null;
  tables: Record<string, number>;
  changedTables: string[];
  newImages: number;
  pendingImages: number; // 시간이 모자라 다음 실행으로 미룬 이미지 수
};

async function dumpTable(db: SupabaseClient, name: string, order: string[]) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(name).select('*');
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`dump ${name}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** 버킷 안 모든 파일 경로 (폴더는 재귀) */
async function listObjects(db: SupabaseClient, prefix = ''): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${BUCKET}/${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) paths.push(...(await listObjects(db, path))); // 폴더
      else if (!item.name.startsWith('.')) paths.push(path); // .emptyFolderPlaceholder 제외
    }
    if (data.length < PAGE) return paths;
  }
}

export async function runBackup(opts: { repo: string; token: string; deadline: number }): Promise<BackupResult> {
  const db = createServiceClient();
  const gh = new GitHubRepo(opts.repo, opts.token);
  const snap = await gh.snapshot();
  const blobs: { path: string; sha: string }[] = [];

  // 1) DB
  const tables: Record<string, number> = {};
  const changedTables: string[] = [];
  for (const t of TABLES) {
    const rows = await dumpTable(db, t.name, t.order);
    tables[t.name] = rows.length;
    const content = Buffer.from(JSON.stringify(rows, null, 2) + '\n', 'utf8');
    const path = `db/${t.name}.json`;
    if (snap.files.get(path) === gitBlobSha(content)) continue;
    blobs.push({ path, sha: await gh.createBlob(content) });
    changedTables.push(t.name);
  }

  // 2) 이미지: 저장소에 없는 것만 (파일명에 UUID가 들어 있어 같은 경로의 내용이 바뀌지 않음)
  const missing = (await listObjects(db)).filter((p) => !snap.files.has(`images/${p}`));
  let newImages = 0;
  let next = 0;
  const worker = async () => {
    while (next < missing.length && Date.now() < opts.deadline) {
      const path = missing[next++];
      const { data, error } = await db.storage.from(BUCKET).download(path);
      if (error) throw new Error(`download ${path}: ${error.message}`);
      const sha = await gh.createBlob(Buffer.from(await data.arrayBuffer()));
      blobs.push({ path: `images/${path}`, sha });
      newImages++;
    }
  };
  await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));

  const result = { tables, changedTables, newImages, pendingImages: missing.length - newImages };
  if (blobs.length === 0) return { commit: null, ...result };

  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
  const parts = [
    changedTables.length ? `db: ${changedTables.join(', ')}` : null,
    newImages ? `images: +${newImages}` : null,
  ].filter(Boolean);
  const commit = await gh.commit({
    ...snap,
    blobs,
    message: `backup: ${date} (${parts.join(' / ')})`,
  });
  return { commit, ...result };
}
