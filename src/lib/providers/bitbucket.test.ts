import { describe, it, expect, vi } from "vitest";
import { BitbucketProvider } from "./bitbucket";
import { createBitbucketRepo } from "../__tests__/fixtures";

describe("BitbucketProvider", () => {
  const provider = new BitbucketProvider();

  describe("parseUrl", () => {
    it("표준 clone URL 파싱", () => {
      const result = provider.parseUrl(
        "https://git.example.com/scm/PROJ/repo.git"
      );
      expect(result).toEqual({
        owner: "PROJ",
        repo: "repo",
        baseUrl: "https://git.example.com",
      });
    });

    it(".git 없는 URL 파싱", () => {
      const result = provider.parseUrl(
        "https://git.example.com/scm/PROJ/repo"
      );
      expect(result).toEqual({
        owner: "PROJ",
        repo: "repo",
        baseUrl: "https://git.example.com",
      });
    });

    it("http 프로토콜 지원", () => {
      const result = provider.parseUrl(
        "http://git.local/scm/TEAM/repo.git"
      );
      expect(result).toEqual({
        owner: "TEAM",
        repo: "repo",
        baseUrl: "http://git.local",
      });
    });

    it("비 Bitbucket URL은 null 반환", () => {
      const result = provider.parseUrl("https://github.com/o/r");
      expect(result).toBeNull();
    });

    it("잘못된 문자열은 null 반환", () => {
      const result = provider.parseUrl("random");
      expect(result).toBeNull();
    });
  });

  describe("buildSourceUrl", () => {
    const repo = createBitbucketRepo();

    it("skill 타입 → /browse/{path}/{name}?at={branch}", () => {
      const url = provider.buildSourceUrl(repo, "skills", "my-skill", "skill");
      expect(url).toBe(
        "https://git.example.com/projects/PROJ/repos/repo/browse/skills/my-skill?at=master"
      );
    });

    it("non-skill 타입 → /browse/{path}/{name}.md?at={branch}", () => {
      const url = provider.buildSourceUrl(repo, "agents", "my-agent", "agent");
      expect(url).toBe(
        "https://git.example.com/projects/PROJ/repos/repo/browse/agents/my-agent.md?at=master"
      );
    });
  });

  describe("getLastCommitDate", () => {
    const repo = createBitbucketRepo();

    it("파일 경로의 최신 커밋 날짜를 ISO string으로 반환", async () => {
      const timestamp = 1711000000000; // 2024-03-21T...
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [{ authorTimestamp: timestamp }] }),
      } as Response);

      const result = await provider.getLastCommitDate!(repo, "skills/my-skill/SKILL.md");
      expect(result).toBe(new Date(timestamp).toISOString());
    });

    it("커밋이 없으면 null 반환", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [] }),
      } as Response);

      const result = await provider.getLastCommitDate!(repo, "skills/nonexistent/SKILL.md");
      expect(result).toBeNull();
    });

    it("API 에러 시 null 반환 (throw 없음)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
      } as Response);

      const result = await provider.getLastCommitDate!(repo, "skills/error/SKILL.md");
      expect(result).toBeNull();
    });
  });
});
