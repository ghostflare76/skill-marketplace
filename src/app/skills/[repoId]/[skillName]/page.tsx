"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skill } from "@/lib/types";
import { getCategoryBadgeClass } from "@/lib/categoryColors";
import { ProviderIcon, getProviderLabel } from "@/components/ProviderIcon";
import { formatDate } from "@/lib/format-date";

const RELATED_PATTERN = /see\s+([\w-]+)/gi;

const MarkdownRenderer = dynamic(() => import("@/components/MarkdownRenderer"), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-gray-800 rounded-xl" />,
});

export default function SkillDetailPage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const skillName = params.skillName as string;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    async function fetchSkill() {
      try {
        const res = await fetch(`/api/skills/${repoId}/${skillName}`);
        if (!res.ok) throw new Error("Skill not found");
        const data = await res.json();
        setSkill(data);
      } catch (err) {
        setError("Failed to load skill details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSkill();
  }, [repoId, skillName]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-32 bg-gray-800 rounded" />
          <div className="h-10 w-64 bg-gray-800 rounded" />
          <div className="h-6 w-full bg-gray-800 rounded" />
          <div className="h-6 w-3/4 bg-gray-800 rounded" />
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-red-400 text-lg mb-4">{error || "Skill not found"}</div>
        <Link
          href="/"
          className="text-indigo-400 hover:text-indigo-300 text-sm"
        >
          Back to all skills
        </Link>
      </div>
    );
  }

  // Parse related skills from description (e.g., "see signup-flow-cro")
  const relatedSkills = Array.from(
    skill.description.matchAll(RELATED_PATTERN),
    (m) => m[1]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300 transition-colors">
          Skills
        </Link>
        <span>/</span>
        <span className="text-gray-300">{skill.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{skill.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${getCategoryBadgeClass(skill.category)}`}>
                {skill.category}
              </span>
              <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs font-mono text-gray-400">
                v{skill.version}
              </span>
              {skill.pluginName && (
                <span className="inline-flex items-center rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/20">
                  plugin: {skill.pluginName}
                </span>
              )}
              <span className="text-sm text-gray-500">
                from {skill.repoDisplayName}
              </span>
              {skill.lastUpdated && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-sm text-gray-500">
                    Updated {formatDate(skill.lastUpdated)}
                  </span>
                </>
              )}
            </div>
          </div>
          <a
            href={skill.sourceUrl || skill.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <ProviderIcon provider={skill.providerType || "github"} className="h-4 w-4" />
            View on {getProviderLabel(skill.providerType || "github")}
          </a>
        </div>

        <p className="text-gray-400 leading-relaxed">{skill.description}</p>
      </div>

      {/* Install Command */}
      <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-400">Installation</span>
          <button
            onClick={() => handleCopy(skill.installCommand)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="text-sm text-green-400 font-mono bg-gray-950 rounded-lg p-3 whitespace-pre-wrap">
          {skill.installCommand}
        </pre>
      </div>

      {/* Related Skills */}
      {relatedSkills.length > 0 && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <span className="text-sm font-medium text-gray-400 block mb-2">
            Related Skills
          </span>
          <div className="flex flex-wrap gap-2">
            {relatedSkills.map((rs) => (
              <Link
                key={rs}
                href={`/skills/${repoId}/${rs}`}
                className="inline-flex items-center rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {rs}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-6 sm:p-8">
        <MarkdownRenderer content={skill.content} />
      </div>
    </div>
  );
}
