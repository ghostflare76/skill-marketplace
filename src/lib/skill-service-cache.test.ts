import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGithubRepo } from "./__tests__/fixtures";
import type { SkillEntry } from "./providers/types";

// Mock registry — getProvider가 fake provider 반환
const mockGetSkillDirectories = vi.fn();
const mockGetSkillContent = vi.fn();
const mockBuildSourceUrl = vi.fn(() => "https://source.url");
const mockGetLastCommitDate = vi.fn();

vi.mock("./providers/registry", () => ({
  getProvider: () => ({
    name: "github",
    displayName: "GitHub",
    urlPattern: /github\.com/,
    getSkillDirectories: mockGetSkillDirectories,
    getSkillContent: mockGetSkillContent,
    buildSourceUrl: mockBuildSourceUrl,
    getLastCommitDate: mockGetLastCommitDate,
  }),
}));

import {
  getSkillDirectories,
  getSkillContent,
  getAllSkills,
  getSkillByName,
  invalidateRepoCache,
} from "./skill-service";

describe("skill-service cache & orchestration", () => {
  const repo = createGithubRepo();

  beforeEach(() => {
    invalidateRepoCache(); // 전체 캐시 클리어
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("cache", () => {
    const fakeEntries: SkillEntry[] = [
      { name: "skill-a", sourceType: "skill", sourcePath: "skills", flat: false },
    ];

    it("invalidateRepoCache() 전체 캐시 삭제 — 두 번 호출 시 provider 2회 호출", async () => {
      mockGetSkillDirectories.mockResolvedValue(fakeEntries);

      await getSkillDirectories(repo);
      invalidateRepoCache();
      await getSkillDirectories(repo);

      expect(mockGetSkillDirectories).toHaveBeenCalledTimes(2);
    });

    it("invalidateRepoCache(repoId) 해당 repo만 삭제", async () => {
      const repo2 = createGithubRepo({ id: "github:other-repo" });
      mockGetSkillDirectories.mockResolvedValue(fakeEntries);

      await getSkillDirectories(repo);
      await getSkillDirectories(repo2);
      invalidateRepoCache(repo.id);
      await getSkillDirectories(repo);
      await getSkillDirectories(repo2);

      // repo: 2회, repo2: 캐시 히트로 여전히 1회 = 총 3회
      expect(mockGetSkillDirectories).toHaveBeenCalledTimes(3);
    });

    it("TTL 내 캐시 히트 — 동일 호출 2회, mock 1회", async () => {
      mockGetSkillDirectories.mockResolvedValue(fakeEntries);

      await getSkillDirectories(repo);
      await getSkillDirectories(repo);

      expect(mockGetSkillDirectories).toHaveBeenCalledTimes(1);
    });

    it("TTL 만료 후 캐시 미스", async () => {
      vi.useFakeTimers();
      mockGetSkillDirectories.mockResolvedValue(fakeEntries);

      await getSkillDirectories(repo);
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1시간 + 1ms
      await getSkillDirectories(repo);

      expect(mockGetSkillDirectories).toHaveBeenCalledTimes(2);
    });

    it("getSkillContent non-null 캐시 — 2회 호출, mock 1회", async () => {
      mockGetSkillContent.mockResolvedValue("# content");

      await getSkillContent(repo, "skill-a", "skills", false);
      await getSkillContent(repo, "skill-a", "skills", false);

      expect(mockGetSkillContent).toHaveBeenCalledTimes(1);
    });

    it("getSkillContent null은 캐시 안 함 — 2회 호출, mock 2회", async () => {
      mockGetSkillContent.mockResolvedValue(null);

      await getSkillContent(repo, "skill-a", "skills", false);
      await getSkillContent(repo, "skill-a", "skills", false);

      expect(mockGetSkillContent).toHaveBeenCalledTimes(2);
    });
  });

  describe("orchestration", () => {
    it("getAllSkills 여러 repo 스킬 집계", async () => {
      const entries: SkillEntry[] = [
        { name: "s1", sourceType: "skill", sourcePath: "skills", flat: true },
        { name: "s2", sourceType: "agent", sourcePath: "agents", flat: true },
      ];
      mockGetSkillDirectories.mockResolvedValue(entries);
      mockGetSkillContent.mockResolvedValue("---\nname: X\n---\ncontent");

      const skills = await getAllSkills([repo]);

      expect(skills).toHaveLength(2);
      expect(skills[0].slug).toBe("s1");
      expect(skills[1].slug).toBe("s2");
    });

    it("getAllSkills content null인 엔트리 스킵", async () => {
      const entries: SkillEntry[] = [
        { name: "s1", sourceType: "skill", sourcePath: "skills", flat: true },
        { name: "s2", sourceType: "skill", sourcePath: "skills", flat: true },
      ];
      mockGetSkillDirectories.mockResolvedValue(entries);
      mockGetSkillContent
        .mockResolvedValueOnce("---\nname: S1\n---\ncontent")
        .mockResolvedValueOnce(null);

      const skills = await getAllSkills([repo]);

      expect(skills).toHaveLength(1);
      expect(skills[0].slug).toBe("s1");
    });

    it("getSkillByName 매칭 스킬 반환", async () => {
      const entries: SkillEntry[] = [
        { name: "target", sourceType: "skill", sourcePath: "skills", flat: true },
      ];
      mockGetSkillDirectories.mockResolvedValue(entries);
      mockGetSkillContent.mockResolvedValue("---\nname: Target\n---\ncontent");

      const skill = await getSkillByName([repo], repo.id, "target");

      expect(skill).not.toBeNull();
      expect(skill!.slug).toBe("target");
      expect(skill!.name).toBe("Target");
    });

    it("getSkillByName 미존재 repo/skill → null", async () => {
      const skill = await getSkillByName([repo], "nonexistent", "skill");
      expect(skill).toBeNull();
    });
  });

  describe("isNew integration (커밋 날짜 연동)", () => {
    it("getLastCommitDate가 7일 이내 날짜 반환 시 isNew === true", async () => {
      const entries: SkillEntry[] = [
        { name: "new-skill", sourceType: "skill", sourcePath: "skills", flat: false },
      ];
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockGetSkillDirectories.mockResolvedValue(entries);
      mockGetSkillContent.mockResolvedValue("---\nname: New Skill\n---\ncontent");
      mockGetLastCommitDate.mockResolvedValue(recentDate);

      const skills = await getAllSkills([repo]);

      expect(skills[0].isNew).toBe(true);
      expect(skills[0].lastUpdated).toBe(recentDate);
      expect(mockGetLastCommitDate).toHaveBeenCalledWith(repo, "skills/new-skill/SKILL.md");
    });

    it("getLastCommitDate가 7일 초과 날짜 반환 시 isNew === false", async () => {
      const entries: SkillEntry[] = [
        { name: "old-skill", sourceType: "agent", sourcePath: "agents", flat: true },
      ];
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      mockGetSkillDirectories.mockResolvedValue(entries);
      mockGetSkillContent.mockResolvedValue("---\nname: Old Skill\n---\ncontent");
      mockGetLastCommitDate.mockResolvedValue(oldDate);

      const skills = await getAllSkills([repo]);

      expect(skills[0].isNew).toBe(false);
      expect(mockGetLastCommitDate).toHaveBeenCalledWith(repo, "agents/old-skill.md");
    });

    it("getLastCommitDate가 null 반환 시 isNew === false", async () => {
      const entries: SkillEntry[] = [
        { name: "no-date", sourceType: "command", sourcePath: "commands", flat: true },
      ];

      mockGetSkillDirectories.mockResolvedValue(entries);
      mockGetSkillContent.mockResolvedValue("---\nname: No Date\n---\ncontent");
      mockGetLastCommitDate.mockResolvedValue(null);

      const skills = await getAllSkills([repo]);

      expect(skills[0].isNew).toBe(false);
    });
  });
});
