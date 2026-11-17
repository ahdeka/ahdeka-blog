// 백업 저장소의 db/*.json → 복구용 SQL 한 파일로 변환 (docs/backup.md)
// 사용: node scripts/backup-to-sql.mjs <백업 저장소 경로> > restore.sql
//      → Supabase SQL Editor에 붙여넣어 실행 (마이그레이션을 모두 적용한 빈 DB 기준)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// src/lib/backup/run-backup.ts 의 TABLES 와 같은 순서 (외래 키 의존 순서)
const TABLES = [
  'admins',
  'categories',
  'tags',
  'posts',
  'post_translations',
  'post_tags',
  'post_images',
  'post_stats',
  'comments',
];
// generated always as identity 컬럼 → 값을 그대로 넣으려면 overriding system value + 시퀀스 맞추기
const IDENTITY = { categories: ['id'], tags: ['id'], posts: ['number'], post_translations: ['id'] };

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/backup-to-sql.mjs <backup-repo-dir>');
  process.exit(1);
}

const out = [
  '-- 생성: scripts/backup-to-sql.mjs',
  'begin;',
  // 트리거(댓글 부모·카테고리 깊이 검사 등)와 외래 키 검사를 끄고 넣음 → 행 순서와 상관없이 복구
  'set local session_replication_role = replica;',
];

for (const table of TABLES) {
  const file = join(dir, 'db', `${table}.json`);
  if (!existsSync(file)) {
    out.push(`-- ${table}: 파일 없음, 건너뜀`);
    continue;
  }
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  out.push(`\n-- ${table}: ${rows.length}행`);
  if (rows.length === 0) continue;
  if (table === 'admins') {
    out.push('-- admins.user_id 는 auth.users 를 가리킴 → 관리자 계정을 먼저 만들고, id가 달라졌으면 직접 수정할 것');
  }
  const json = JSON.stringify(rows);
  if (json.includes('$backup$')) throw new Error(`${table}: data contains $backup$`);
  const overriding = IDENTITY[table] ? ' overriding system value' : '';
  out.push(
    `insert into public.${table}${overriding}\n` +
      `select * from jsonb_populate_recordset(null::public.${table}, $backup$${json}$backup$::jsonb);`,
  );
  for (const col of IDENTITY[table] ?? []) {
    out.push(
      `select setval(pg_get_serial_sequence('public.${table}', '${col}'), ` +
        `coalesce((select max(${col}) from public.${table}), 0) + 1, false);`,
    );
  }
}

out.push('\ncommit;');
console.log(out.join('\n'));
