import { describe, it, expect, vi } from "vitest";
import { GitHubProvider } from "./github";
import { createGithubRepo } from "../__tests__/fixtures";

describe("GitHubProvider", () => {
  const provider = new GitHubProvider();

  describe("parseUrl", () => {
    it("표준 GitHub URL 파싱", () => {
      const result = provider.parseUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it(".git 접미사 제거", () => {
      const result = provider.parseUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("비 GitHub URL은 null 반환", () => {
      const result = provider.parseUrl("https://bitbucket.org/o/r");
      expect(result).toBeNull();
    });

    it("잘못된 URL은 null 반환", () => {
      const result = provider.parseUrl("not-a-url");
      expect(result).toBeNull();
    });
  });

  describe("buildSourceUrl", () => {
    const repo = createGithubRepo();

    it("skill 타입 → /tree/{branch}/... 경로", () => {
      const url = provider.buildSourceUrl(repo, "skills", "my-skill", "skill");
      expect(url).toBe(
        "https://github.com/owner/repo/tree/main/skills/my-skill"
      );
    });

    it("agent 타입 → /blob/{branch}/... 경로", () => {
      const url = provider.buildSourceUrl(repo, "agents", "my-agent", "agent");
      expect(url).toBe(
        "https://github.com/owner/repo/blob/main/agents/my-agent.md"
      );
    });
  });

  describe("getLastCommitDate", () => {
    const repo = createGithubRepo();

    it("파일 경로의 최신 커밋 날짜를 반환", async () => {
      const mockDate = "2026-03-20T10:00:00Z";
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "listCommits").mockResolvedValueOnce({
        data: [{ commit: { committer: { date: mockDate } } }],
      } as never);

      const result = await provider.getLastCommitDate!(repo, "skills/my-skill/SKILL.md");
      expect(result).toBe(mockDate);
    });

    it("커밋이 없으면 null 반환", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "listCommits").mockResolvedValueOnce({
        data: [],
      } as never);

      const result = await provider.getLastCommitDate!(repo, "skills/nonexistent/SKILL.md");
      expect(result).toBeNull();
    });

    it("API 에러 시 null 반환 (throw 없음)", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "listCommits").mockRejectedValueOnce(new Error("API Error"));

      const result = await provider.getLastCommitDate!(repo, "skills/error/SKILL.md");
      expect(result).toBeNull();
    });
  });

  describe("getFileContent", () => {
    const repo = createGithubRepo();

    it("파일 존재 시 base64 디코딩된 내용 반환", async () => {
      const content = Buffer.from("hello world").toString("base64");
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "getContent").mockResolvedValueOnce({
        data: { content, encoding: "base64" },
      } as never);

      const result = await provider.getFileContent!(repo, "plugins/test/.claude-plugin/plugin.json");
      expect(result).toBe("hello world");
    });

    it("파일이 디렉토리인 경우 null 반환", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "getContent").mockResolvedValueOnce({
        data: [{ name: "file1.ts" }],
      } as never);

      const result = await provider.getFileContent!(repo, "some/dir");
      expect(result).toBeNull();
    });

    it("404 에러 시 null 반환", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "getContent").mockRejectedValueOnce(new Error("Not Found"));

      const result = await provider.getFileContent!(repo, "nonexistent/file.json");
      expect(result).toBeNull();
    });
  });

  describe("listDirectoryNames", () => {
    const repo = createGithubRepo();

    it("디렉토리 존재 시 이름 배열 반환", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "getContent").mockResolvedValueOnce({
        data: [
          { name: "pluginA", type: "dir" },
          { name: "pluginB", type: "dir" },
          { name: "README.md", type: "file" },
        ],
      } as never);

      const result = await provider.listDirectoryNames!(repo, "plugins");
      expect(result).toEqual(["pluginA", "pluginB", "README.md"]);
    });

    it("404 시 빈 배열 반환", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "getContent").mockRejectedValueOnce(new Error("Not Found"));

      const result = await provider.listDirectoryNames!(repo, "nonexistent");
      expect(result).toEqual([]);
    });

    it("API 에러 시 빈 배열 반환", async () => {
      // @ts-expect-error - private 프로퍼티 접근
      vi.spyOn(provider.octokit.rest.repos, "getContent").mockRejectedValueOnce(new Error("Server Error"));

      const result = await provider.listDirectoryNames!(repo, "plugins");
      expect(result).toEqual([]);
    });
  });
});
