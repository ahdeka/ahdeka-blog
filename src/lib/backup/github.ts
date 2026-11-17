import 'server-only';
import { createHash } from 'node:crypto';

// GitHub Git Data API로 여러 파일을 커밋 하나에 묶어서 올림
// (Contents API는 파일마다 커밋이 하나씩 생겨서 쓰지 않음)
// 저장소는 비어 있으면 안 됨 → 만들 때 README로 초기화할 것 (빈 저장소는 Git Data API가 409)

const API = 'https://api.github.com';

export type RepoFile = { path: string; content: Buffer };

export class GitHubRepo {
  constructor(
    private readonly repo: string, // "owner/name"
    private readonly token: string,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}/repos/${this.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'blog-backup',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub ${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  /** 기본 브랜치의 최신 커밋과, 저장소 안 모든 파일의 path → blob sha */
  async snapshot() {
    const { default_branch: branch } = await this.call<{ default_branch: string }>('GET', '');
    const ref = await this.call<{ object: { sha: string } }>('GET', `/git/ref/heads/${branch}`);
    const commit = await this.call<{ tree: { sha: string } }>('GET', `/git/commits/${ref.object.sha}`);
    const tree = await this.call<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>(
      'GET',
      `/git/trees/${commit.tree.sha}?recursive=1`,
    );
    if (tree.truncated) throw new Error('GitHub tree listing truncated (repo too large)');

    const files = new Map<string, string>();
    for (const entry of tree.tree) if (entry.type === 'blob') files.set(entry.path, entry.sha);
    return { branch, headSha: ref.object.sha, treeSha: commit.tree.sha, files };
  }

  async createBlob(content: Buffer): Promise<string> {
    const { sha } = await this.call<{ sha: string }>('POST', '/git/blobs', {
      content: content.toString('base64'),
      encoding: 'base64',
    });
    return sha;
  }

  /** base 트리 위에 blob들을 얹어 커밋하고 브랜치를 앞으로 이동 */
  async commit(opts: {
    branch: string;
    headSha: string;
    treeSha: string;
    blobs: { path: string; sha: string }[];
    message: string;
  }): Promise<string> {
    const tree = await this.call<{ sha: string }>('POST', '/git/trees', {
      base_tree: opts.treeSha,
      tree: opts.blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
    });
    const commit = await this.call<{ sha: string }>('POST', '/git/commits', {
      message: opts.message,
      tree: tree.sha,
      parents: [opts.headSha],
    });
    // force: false → 그 사이 다른 커밋이 생겼으면 실패 (다음 실행 때 다시 시도)
    await this.call('PATCH', `/git/refs/heads/${opts.branch}`, { sha: commit.sha, force: false });
    return commit.sha;
  }
}

/** git이 계산하는 blob sha와 같은 값 → 내용이 같은 파일은 업로드하지 않음 */
export function gitBlobSha(content: Buffer): string {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}
