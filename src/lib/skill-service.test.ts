import { describe, it, expect } from "vitest";
import { parseSkillMd } from "./skill-service";
import { createGithubRepo, createBitbucketRepo } from "./__tests__/fixtures";

describe("parseSkillMd", () => {
  const repo = createGithubRepo();

  it("유효한 YAML frontmatter 파싱", () => {
    const raw = `---
name: Test Skill
version: 1.2.3
description: A test skill
---

# Content here`;
    const skill = parseSkillMd(raw, "test-skill", repo, "skill", "skills");

    expect(skill.name).toBe("Test Skill");
    expect(skill.version).toBe("1.2.3");
    expect(skill.description).toBe("A test skill");
    expect(skill.content).toContain("# Content here");
  });

  it("frontmatter 필드 누락 시 기본값 사용", () => {
    const raw = `---
---

Some content`;
    const skill = parseSkillMd(raw, "my-skill", repo, "skill", "skills");

    expect(skill.name).toBe("my-skill");
    expect(skill.version).toBe("0.0.0");
    expect(skill.description).toBe("");
  });

  it("frontmatter 없는 마크다운은 raw 전체를 content로", () => {
    const raw = "# Just markdown\n\nNo frontmatter here.";
    const skill = parseSkillMd(raw, "plain", repo, "agent", "agents");

    expect(skill.content).toContain("# Just markdown");
    expect(skill.name).toBe("plain");
  });

  it("빈 문자열 입력 시 기본값으로 Skill 생성, throw 없음", () => {
    const skill = parseSkillMd("", "empty", repo, "skill", "skills");

    expect(skill.name).toBe("empty");
    expect(skill.version).toBe("0.0.0");
    expect(skill.description).toBe("");
    expect(skill.slug).toBe("empty");
  });

  it("잘못된 YAML (콜론 특수문자)에서 throw 없이 graceful fallback", () => {
    const raw = `---
name: invalid: yaml: here
---

Content`;
    expect(() =>
      parseSkillMd(raw, "bad-yaml", repo, "skill", "skills")
    ).not.toThrow();
  });

  it("installCommand 올바른 포맷", () => {
    const raw = "---\nname: x\n---\ncontent";
    const skill = parseSkillMd(raw, "my-skill", repo, "skill", "skills");

    expect(skill.installCommand).toContain(
      `/plugin marketplace add ${repo.owner}/${repo.repo}`
    );
    expect(skill.installCommand).toContain(
      `/plugin install my-skill@${repo.repo}`
    );
  });

  it("pluginName이 있으면 installTarget으로 사용", () => {
    const raw = "---\nname: x\n---\ncontent";
    const skill = parseSkillMd(
      raw,
      "my-skill",
      repo,
      "skill",
      "plugins/my-plugin/skills",
      "my-plugin"
    );

    expect(skill.installCommand).toContain(
      `/plugin install my-plugin@${repo.repo}`
    );
    expect(skill.pluginName).toBe("my-plugin");
  });

  it("sourceUrl 올바른 생성", () => {
    const raw = "---\nname: x\n---\ncontent";
    const skill = parseSkillMd(raw, "my-skill", repo, "skill", "skills");

    expect(skill.sourceUrl).toBe(
      "https://github.com/owner/repo/tree/main/skills/my-skill"
    );
  });

  it("Bitbucket Server installCommand는 full git URL 사용", () => {
    const bbRepo = createBitbucketRepo();
    const raw = "---\nname: x\n---\ncontent";
    const skill = parseSkillMd(raw, "my-skill", bbRepo, "skill", "skills");

    expect(skill.installCommand).toContain(
      `/plugin marketplace add ${bbRepo.baseUrl}/scm/${bbRepo.owner}/${bbRepo.repo}.git`
    );
    expect(skill.installCommand).toContain(
      `/plugin install my-skill@${bbRepo.repo}`
    );
  });

  it("githubUrl === sourceUrl (하위호환)", () => {
    const raw = "---\nname: x\n---\ncontent";
    const skill = parseSkillMd(raw, "my-skill", repo, "skill", "skills");

    expect(skill.githubUrl).toBe(skill.sourceUrl);
  });

  describe("isNew 및 lastUpdated (커밋 날짜 기반)", () => {
    const raw = "---\nname: New Skill\n---\ncontent";

    it("lastCommitDate가 7일 이내이면 isNew === true", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const skill = parseSkillMd(raw, "new-skill", repo, "skill", "skills", undefined, twoDaysAgo);

      expect(skill.isNew).toBe(true);
      expect(skill.lastUpdated).toBe(twoDaysAgo);
    });

    it("lastCommitDate가 7일 초과이면 isNew === false", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const skill = parseSkillMd(raw, "old-skill", repo, "skill", "skills", undefined, tenDaysAgo);

      expect(skill.isNew).toBe(false);
      expect(skill.lastUpdated).toBe(tenDaysAgo);
    });

    it("lastCommitDate가 정확히 7일이면 isNew === true", () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const skill = parseSkillMd(raw, "edge-skill", repo, "skill", "skills", undefined, sevenDaysAgo);

      expect(skill.isNew).toBe(true);
    });

    it("lastCommitDate 미전달 시 isNew === false, lastUpdated는 현재 시각", () => {
      const before = new Date().toISOString();
      const skill = parseSkillMd(raw, "no-date", repo, "skill", "skills");
      const after = new Date().toISOString();

      expect(skill.isNew).toBe(false);
      expect(skill.lastUpdated >= before).toBe(true);
      expect(skill.lastUpdated <= after).toBe(true);
    });
  });
});
