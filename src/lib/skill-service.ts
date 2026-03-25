import matter from "gray-matter";
import { Skill, SkillRepository } from "./types";
import { SkillEntry } from "./providers/types";
import { getProvider } from "./providers/registry";
import { buildSkillFilePath } from "./providers/constants";
import { resolveSkillVersion } from "./version-resolver";

// In-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateRepoCache(repoId?: string): void {
  if (!repoId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (
      key.startsWith(`dirs:${repoId}`) ||
      key.startsWith(`content:${repoId}:`) ||
      key.startsWith("all-skills:")
    ) {
      cache.delete(key);
    }
  }
}

export async function getSkillDirectories(
  repo: SkillRepository
): Promise<SkillEntry[]> {
  const cacheKey = `dirs:${repo.id}`;
  const cached = getCached<SkillEntry[]>(cacheKey);
  if (cached) return cached;

  const provider = getProvider(repo.provider);
  const entries = await provider.getSkillDirectories(repo);

  setCache(cacheKey, entries);
  return entries;
}

export async function getSkillContent(
  repo: SkillRepository,
  skillName: string,
  sourcePath: string,
  flat: boolean
): Promise<string | null> {
  const cacheKey = `content:${repo.id}:${sourcePath}:${skillName}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const provider = getProvider(repo.provider);
  const content = await provider.getSkillContent(repo, skillName, sourcePath, flat);

  if (content) {
    setCache(cacheKey, content);
  }
  return content;
}

const NEW_SKILL_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function isWithinDays(dateStr: string, days: number): boolean {
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return false;
  const diff = Date.now() - time;
  return diff >= 0 && diff <= days * MS_PER_DAY;
}

export function parseSkillMd(
  raw: string,
  skillName: string,
  repo: SkillRepository,
  sourceType: "skill" | "agent" | "command",
  sourcePath: string,
  pluginName?: string,
  lastCommitDate?: string
): Skill {
  let frontmatter: Record<string, string> = {};
  let content = raw;

  try {
    const parsed = matter(raw);
    frontmatter = parsed.data as Record<string, string>;
    content = parsed.content;
  } catch {
    // YAML 파싱 실패 시 (콜론 등 특수문자) raw 전체를 content로 사용
    console.warn(`Failed to parse frontmatter for ${skillName}, using raw content`);
  }

  const provider = getProvider(repo.provider);
  const sourceUrl = provider.buildSourceUrl(repo, sourcePath, skillName, sourceType);

  const installTarget = pluginName || skillName;
  const marketplaceSource = repo.baseUrl
    ? `${repo.baseUrl}/scm/${repo.owner}/${repo.repo}.git`
    : `${repo.owner}/${repo.repo}`;
  const installCommand = `/plugin marketplace add ${marketplaceSource}\n/plugin install ${installTarget}@${repo.repo}`;

  return {
    slug: skillName,
    name: frontmatter.name || skillName,
    version: "0.0.0",
    description: frontmatter.description || "",
    repoId: repo.id,
    repoDisplayName: repo.displayName,
    category: sourceType,
    categoryId: sourceType,
    sourceType,
    content,
    lastUpdated: lastCommitDate || new Date().toISOString(),
    isNew: lastCommitDate ? isWithinDays(lastCommitDate, NEW_SKILL_THRESHOLD_DAYS) : false,
    githubUrl: sourceUrl, // 하위 호환
    sourceUrl,
    providerType: repo.provider,
    installCommand,
    pluginName,
  };
}

export async function getAllSkills(
  repos: SkillRepository[]
): Promise<Skill[]> {
  const repoIds = repos.map((r) => r.id).join(",");
  const cacheKey = `all-skills:${repoIds}`;
  const cached = getCached<Skill[]>(cacheKey);
  if (cached) return cached;

  const allSkills: Skill[] = [];

  for (const repo of repos) {
    const provider = getProvider(repo.provider);
    const entries = await getSkillDirectories(repo);

    const skillPromises = entries.map(async (entry) => {
      const raw = await getSkillContent(repo, entry.name, entry.sourcePath, entry.flat);
      if (!raw) return null;

      let lastCommitDate: string | null = null;
      if (provider.getLastCommitDate) {
        const filePath = buildSkillFilePath(entry.sourcePath, entry.name, entry.flat);
        lastCommitDate = await provider.getLastCommitDate(repo, filePath);
      }

      const skill = parseSkillMd(raw, entry.name, repo, entry.sourceType, entry.sourcePath, entry.pluginName, lastCommitDate ?? undefined);
      skill.version = resolveSkillVersion(skill.pluginName, repo);
      return skill;
    });

    const skills = await Promise.all(skillPromises);
    allSkills.push(...skills.filter((s): s is Skill => s !== null));
  }

  allSkills.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  setCache(cacheKey, allSkills);
  return allSkills;
}

export async function getSkillByName(
  repos: SkillRepository[],
  repoId: string,
  skillName: string
): Promise<Skill | null> {
  // all-skills 캐시에서 먼저 찾기 (목록 API와 동일한 데이터 소스 사용)
  const repoIds = repos.map((r) => r.id).join(",");
  const allCached = getCached<Skill[]>(`all-skills:${repoIds}`);
  if (allCached) {
    return allCached.find(
      (s) => s.repoId === repoId && s.slug === skillName
    ) ?? null;
  }

  // all-skills 캐시 미스 → getAllSkills로 전체 fetch 후 찾기
  const allSkills = await getAllSkills(repos);
  return allSkills.find(
    (s) => s.repoId === repoId && s.slug === skillName
  ) ?? null;
}
