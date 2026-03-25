import { SkillRepository } from "./types";
import { RepositoryProviderAdapter } from "./providers/types";

export interface RepoVersionInfo {
  versionMap?: Record<string, string>;
  repoVersion?: string;
}

export async function resolveRepoVersions(
  provider: RepositoryProviderAdapter,
  repo: SkillRepository
): Promise<RepoVersionInfo> {
  if (!provider.getFileContent || !provider.listDirectoryNames) {
    return {};
  }

  // 우선순위 1: plugins/ 폴더 존재 시
  const pluginNames = await provider.listDirectoryNames(repo, "plugins");
  if (pluginNames.length > 0) {
    const versionMap: Record<string, string> = {};

    await Promise.all(
      pluginNames.map(async (name) => {
        const content = await provider.getFileContent!(
          repo,
          `plugins/${name}/.claude-plugin/plugin.json`
        );
        if (content) {
          try {
            const json = JSON.parse(content);
            if (json.version) {
              versionMap[name] = json.version;
            }
          } catch { /* JSON 파싱 실패 시 skip */ }
        }
      })
    );

    if (Object.keys(versionMap).length > 0) {
      return { versionMap };
    }
  }

  // 우선순위 2, 3: marketplace.json
  const marketplaceContent = await provider.getFileContent(
    repo,
    ".claude-plugin/marketplace.json"
  );

  if (marketplaceContent) {
    try {
      const json = JSON.parse(marketplaceContent);

      // 우선순위 2: plugins 필드의 version
      if (json.plugins && Array.isArray(json.plugins) && json.plugins.length > 0) {
        const version = json.plugins[0]?.version;
        if (version) return { repoVersion: version };
      }

      // 우선순위 3: metadata.version
      if (json.metadata?.version) {
        return { repoVersion: json.metadata.version };
      }
    } catch { /* JSON 파싱 실패 시 skip */ }
  }

  return {};
}

export function resolveSkillVersion(
  pluginName: string | undefined,
  repo: SkillRepository
): string {
  if (pluginName && repo.versionMap?.[pluginName]) {
    return repo.versionMap[pluginName];
  }
  if (repo.repoVersion) {
    return repo.repoVersion;
  }
  return "0.0.0";
}
