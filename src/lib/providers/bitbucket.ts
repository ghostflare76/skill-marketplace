import { SkillRepository } from "../types";
import { RepositoryProviderAdapter, SkillEntry } from "./types";
import { SOURCE_DIRS, buildSkillFilePath } from "./constants";

/**
 * Bitbucket Server / Data Center 응답 타입
 * GET {baseUrl}/rest/api/1.0/projects/{project}/repos/{repo}/browse/{path}?at={branch}
 */
interface BbServerBrowseEntry {
  path: { name: string; toString: string };
  type: "FILE" | "DIRECTORY";
  size?: number;
}

interface BbServerBrowseResponse {
  children: {
    values: BbServerBrowseEntry[];
    isLastPage: boolean;
    start: number;
    limit: number;
    nextPageStart?: number;
  };
}

/**
 * Bitbucket Server / Data Center Provider
 *
 * Clone URL 형식: https://{host}/scm/{project}/{repo}.git
 * Browse URL 형식: https://{host}/projects/{project}/repos/{repo}/browse
 * REST API: https://{host}/rest/api/1.0/projects/{project}/repos/{repo}/...
 */
export class BitbucketProvider implements RepositoryProviderAdapter {
  readonly name = "bitbucket";
  readonly displayName = "Bitbucket";
  // Server clone URL: https://{host}/scm/{project}/{repo}.git
  readonly urlPattern = /^https?:\/\/([^/]+)\/scm\/([^/]+)\/([^/]+?)(?:\.git)?$/;

  private get token(): string | undefined {
    return process.env.BITBUCKET_TOKEN;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  parseUrl(url: string): { owner: string; repo: string; baseUrl?: string } | null {
    const match = url.match(this.urlPattern);
    if (!match) return null;
    const host = match[1];
    const project = match[2];
    const repo = match[3].replace(/\.git$/, "");
    const protocol = url.startsWith("https") ? "https" : "http";
    return {
      owner: project,
      repo,
      baseUrl: `${protocol}://${host}`,
    };
  }

  private apiBase(repo: SkillRepository): string {
    const base = repo.baseUrl || "https://bitbucket.org";
    return `${base}/rest/api/1.0/projects/${repo.owner}/repos/${repo.repo}`;
  }

  buildSourceUrl(
    repo: SkillRepository,
    sourcePath: string,
    skillName: string,
    sourceType: string
  ): string {
    const base = repo.baseUrl || "https://bitbucket.org";
    const filePath =
      sourceType === "skill"
        ? `${sourcePath}/${skillName}`
        : `${sourcePath}/${skillName}.md`;
    return `${base}/projects/${repo.owner}/repos/${repo.repo}/browse/${filePath}?at=${repo.branch}`;
  }

  async validateRepository(
    repo: SkillRepository
  ): Promise<{ valid: boolean; error?: string; skillCount?: number }> {
    try {
      const res = await fetch(this.apiBase(repo), { headers: this.headers });
      if (!res.ok) {
        return {
          valid: false,
          error:
            "Bitbucket 저장소를 찾을 수 없습니다. project/repo와 branch를 확인해주세요.",
        };
      }

      const entries = await this.getSkillDirectories(repo);
      if (entries.length === 0) {
        return {
          valid: false,
          error:
            "skills, agents, commands 경로에서 SKILL.md 파일을 찾을 수 없습니다.",
        };
      }
      return { valid: true, skillCount: entries.length };
    } catch {
      return { valid: false, error: "저장소 검증 중 오류가 발생했습니다." };
    }
  }

  /** Bitbucket Server browse API로 디렉토리 내 항목 조회 (paginated) */
  private async listDirectory(
    repo: SkillRepository,
    dirPath: string
  ): Promise<BbServerBrowseEntry[]> {
    const entries: BbServerBrowseEntry[] = [];
    let start = 0;

    while (true) {
      const url = `${this.apiBase(repo)}/browse/${dirPath}?at=${repo.branch}&start=${start}&limit=500`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return entries;

      const data: BbServerBrowseResponse = await res.json();
      if (!data.children) return entries;

      entries.push(...data.children.values);

      if (data.children.isLastPage) break;
      start = data.children.nextPageStart ?? start + data.children.limit;
    }

    return entries;
  }

  /** 파일 존재 여부 확인 (HEAD 요청) */
  private async fileExists(
    repo: SkillRepository,
    filePath: string
  ): Promise<boolean> {
    const url = `${this.apiBase(repo)}/raw/${filePath}?at=${repo.branch}`;
    const res = await fetch(url, { method: "HEAD", headers: this.headers });
    return res.ok;
  }

  async getSkillDirectories(repo: SkillRepository): Promise<SkillEntry[]> {
    const allEntries: SkillEntry[] = [];

    await Promise.all(
      SOURCE_DIRS.map(async ({ path, type }) => {
        try {
          const items = await this.listDirectory(repo, path);
          if (items.length === 0) return;

          if (type === "skill") {
            const subDirs = items.filter((i) => i.type === "DIRECTORY");
            if (subDirs.length > 0) {
              const results = await Promise.all(
                subDirs.map(async (dir) => {
                  const dirName = dir.path.name;
                  const hasSkillMd = await this.fileExists(
                    repo,
                    `${path}/${dirName}/SKILL.md`
                  );
                  return hasSkillMd
                    ? {
                        name: dirName,
                        sourceType: type,
                        sourcePath: path,
                        flat: false,
                      }
                    : null;
                })
              );
              allEntries.push(
                ...(results.filter((e) => e !== null) as SkillEntry[])
              );
            } else {
              const flatFiles = items.filter(
                (i) => i.type === "FILE" && i.path.name.endsWith(".md")
              );
              allEntries.push(
                ...flatFiles.map((file) => ({
                  name: file.path.name.replace(/\.md$/, ""),
                  sourceType: type,
                  sourcePath: path,
                  flat: true,
                }))
              );
            }
          } else {
            const flatFiles = items.filter(
              (i) => i.type === "FILE" && i.path.name.endsWith(".md")
            );
            allEntries.push(
              ...flatFiles.map((file) => ({
                name: file.path.name.replace(/\.md$/, ""),
                sourceType: type,
                sourcePath: path,
                flat: true,
              }))
            );
          }
        } catch {
          // 디렉토리가 없으면 skip
        }
      })
    );

    // Plugin 디렉토리 스캔
    try {
      const pluginItems = await this.listDirectory(repo, "plugins");
      const pluginDirs = pluginItems.filter((i) => i.type === "DIRECTORY");

      await Promise.all(
        pluginDirs.map(async (pluginDir) => {
          const pluginName = pluginDir.path.name;
          await Promise.all(
            SOURCE_DIRS.map(async ({ path, type }) => {
              try {
                const pluginPath = `plugins/${pluginName}/${path}`;
                const items = await this.listDirectory(repo, pluginPath);
                if (items.length === 0) return;

                if (type === "skill") {
                  const subDirs = items.filter(
                    (i) => i.type === "DIRECTORY"
                  );
                  if (subDirs.length > 0) {
                    const results = await Promise.all(
                      subDirs.map(async (dir) => {
                        const dirName = dir.path.name;
                        const hasSkillMd = await this.fileExists(
                          repo,
                          `${pluginPath}/${dirName}/SKILL.md`
                        );
                        return hasSkillMd
                          ? {
                              name: dirName,
                              sourceType: type,
                              sourcePath: pluginPath,
                              flat: false,
                              pluginName,
                            }
                          : null;
                      })
                    );
                    allEntries.push(
                      ...(results.filter((e) => e !== null) as SkillEntry[])
                    );
                  } else {
                    const flatFiles = items.filter(
                      (i) =>
                        i.type === "FILE" && i.path.name.endsWith(".md")
                    );
                    allEntries.push(
                      ...flatFiles.map((file) => ({
                        name: file.path.name.replace(/\.md$/, ""),
                        sourceType: type,
                        sourcePath: pluginPath,
                        flat: true,
                        pluginName,
                      }))
                    );
                  }
                } else {
                  const flatFiles = items.filter(
                    (i) =>
                      i.type === "FILE" && i.path.name.endsWith(".md")
                  );
                  allEntries.push(
                    ...flatFiles.map((file) => ({
                      name: file.path.name.replace(/\.md$/, ""),
                      sourceType: type,
                      sourcePath: pluginPath,
                      flat: true,
                      pluginName,
                    }))
                  );
                }
              } catch {
                // 해당 디렉토리가 없으면 skip
              }
            })
          );
        })
      );
    } catch {
      // plugins/ 디렉토리가 없으면 skip
    }

    return allEntries;
  }

  async getLastCommitDate(
    repo: SkillRepository,
    filePath: string
  ): Promise<string | null> {
    try {
      const url = `${this.apiBase(repo)}/commits?path=${encodeURIComponent(filePath)}&until=${encodeURIComponent(repo.branch)}&limit=1`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return null;
      const data = await res.json();
      const ts = data.values?.[0]?.authorTimestamp;
      return ts ? new Date(ts).toISOString() : null;
    } catch {
      return null;
    }
  }

  async getFileContent(
    repo: SkillRepository,
    filePath: string
  ): Promise<string | null> {
    try {
      const url = `${this.apiBase(repo)}/raw/${filePath}?at=${repo.branch}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  async listDirectoryNames(
    repo: SkillRepository,
    dirPath: string
  ): Promise<string[]> {
    try {
      const items = await this.listDirectory(repo, dirPath);
      return items.map((i) => i.path.name);
    } catch {
      return [];
    }
  }

  async getSkillContent(
    repo: SkillRepository,
    skillName: string,
    sourcePath: string,
    flat: boolean
  ): Promise<string | null> {
    const filePath = buildSkillFilePath(sourcePath, skillName, flat);
    return this.getFileContent(repo, filePath);
  }
}
