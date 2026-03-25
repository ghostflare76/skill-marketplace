import { NextRequest, NextResponse } from "next/server";
import { getAllRepos, addCustomRepo, deleteCustomRepo } from "@/lib/repo-store";
import { invalidateRepoCache } from "@/lib/skill-service";
import { SkillRepository } from "@/lib/types";
import { getProvider } from "@/lib/providers/registry";
import { resolveRepoVersions } from "@/lib/version-resolver";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repos = await getAllRepos();
    return NextResponse.json({ repos });
  } catch (error) {
    console.error("Failed to fetch repos:", error);
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, owner, repo, branch, displayName, description, baseUrl } = body;

    if (!owner || !repo || !displayName) {
      return NextResponse.json(
        { error: "owner, repo, displayName은 필수입니다." },
        { status: 400 }
      );
    }

    const providerName = provider || "github";
    const id = `${providerName}:${owner}-${repo}`;
    const allRepos = await getAllRepos();
    if (allRepos.some((r) => r.id === id)) {
      return NextResponse.json(
        { error: "이미 등록된 저장소입니다." },
        { status: 400 }
      );
    }

    const newRepo: SkillRepository = {
      id,
      provider: providerName,
      owner,
      repo,
      branch: branch || (providerName === "bitbucket" ? "master" : "main"),
      displayName,
      description: description || "",
      ...(baseUrl ? { baseUrl } : {}),
      categories: [],
    };

    // 버전 정보 resolve (1회성)
    try {
      const provider = getProvider(providerName);
      const versionInfo = await resolveRepoVersions(provider, newRepo);
      if (versionInfo.versionMap) newRepo.versionMap = versionInfo.versionMap;
      if (versionInfo.repoVersion) newRepo.repoVersion = versionInfo.repoVersion;
    } catch {
      // 버전 resolve 실패 시 무시 (fallback "0.0.0")
    }

    await addCustomRepo(newRepo);
    invalidateRepoCache();

    return NextResponse.json({ repo: newRepo }, { status: 201 });
  } catch (error) {
    console.error("Failed to add repo:", error);
    return NextResponse.json({ error: "저장소 추가에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
    }

    const deleted = await deleteCustomRepo(id);
    if (!deleted) {
      return NextResponse.json({ error: "해당 저장소를 찾을 수 없습니다." }, { status: 404 });
    }

    invalidateRepoCache(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete repo:", error);
    return NextResponse.json({ error: "저장소 삭제에 실패했습니다." }, { status: 500 });
  }
}
