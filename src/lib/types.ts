export interface SkillRepository {
  id: string;
  provider: string; // "github" | "bitbucket" | ...
  owner: string;    // GitHub: owner, Bitbucket Server: project key
  repo: string;
  branch: string;
  displayName: string;
  description: string;
  baseUrl?: string;  // 자체 호스팅 인스턴스 URL (e.g. "https://git.ncsoft.net")
  categories?: CategoryDefinition[];
}

export interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
  skills: string[];
}

export interface Skill {
  slug: string;
  name: string;
  version: string;
  description: string;
  repoId: string;
  repoDisplayName: string;
  category: string;
  categoryId: string;
  sourceType: "skill" | "agent" | "command";
  content: string;
  lastUpdated: string;
  githubUrl: string; // deprecated: sourceUrl 사용 권장
  sourceUrl: string;
  providerType: string;
  installCommand: string;
  pluginName?: string;
  isNew: boolean;
}

export interface SkillsResponse {
  skills: Skill[];
  categories: CategoryDefinition[];
  repos: { id: string; displayName: string }[];
}
