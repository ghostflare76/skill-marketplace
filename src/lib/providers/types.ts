import { SkillRepository } from "../types";

export interface SkillEntry {
  name: string;
  sourceType: "skill" | "agent" | "command";
  sourcePath: string;
  flat: boolean; // true = {sourcePath}/{name}.md, false = {sourcePath}/{name}/SKILL.md
  pluginName?: string;
}

export interface RepositoryProviderAdapter {
  /** provider 식별자 (e.g. "github", "bitbucket") */
  readonly name: string;

  /** UI 표시명 (e.g. "GitHub", "Bitbucket") */
  readonly displayName: string;

  /** URL 자동감지용 정규식 */
  readonly urlPattern: RegExp;

  /** URL에서 owner/repo 파싱 (자체 호스팅 시 baseUrl 포함) */
  parseUrl(url: string): { owner: string; repo: string; baseUrl?: string } | null;

  /** 저장소 내 스킬 디렉토리 목록 조회 */
  getSkillDirectories(repo: SkillRepository): Promise<SkillEntry[]>;

  /** 스킬 파일 내용 조회 */
  getSkillContent(
    repo: SkillRepository,
    skillName: string,
    sourcePath: string,
    flat: boolean
  ): Promise<string | null>;

  /** 소스 파일의 웹 URL 생성 */
  buildSourceUrl(
    repo: SkillRepository,
    sourcePath: string,
    skillName: string,
    sourceType: string
  ): string;

  /** 저장소 존재 여부 및 스킬 포함 검증 */
  validateRepository(
    repo: SkillRepository
  ): Promise<{ valid: boolean; error?: string; skillCount?: number }>;

  /** 스킬 파일의 최종 커밋 날짜 조회 (ISO string 반환) */
  getLastCommitDate?(
    repo: SkillRepository,
    filePath: string
  ): Promise<string | null>;

  /** 임의 경로의 파일 내용 조회 (없으면 null) */
  getFileContent?(
    repo: SkillRepository,
    filePath: string
  ): Promise<string | null>;

  /** 디렉토리 내 항목명 목록 조회 (없으면 빈 배열) */
  listDirectoryNames?(
    repo: SkillRepository,
    dirPath: string
  ): Promise<string[]>;
}
