"use client";

import Link from "next/link";
import { Skill } from "@/lib/types";
import { getCategoryBadgeClass, NEW_BADGE_CLASS } from "@/lib/categoryColors";
import CategoryIcon from "@/components/CategoryIcon";

interface SkillCardProps {
  skill: Skill;
}

export default function SkillCard({ skill }: SkillCardProps) {
  const truncatedDesc =
    skill.description.length > 160
      ? skill.description.substring(0, 160) + "..."
      : skill.description;

  return (
    <Link
      href={`/skills/${skill.repoId}/${skill.slug}`}
      className="group relative block rounded-xl border border-gray-800 bg-gray-900/50 p-5 transition-all hover:border-indigo-500/50 hover:bg-gray-900 hover:shadow-lg hover:shadow-indigo-500/5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
            {skill.name}
          </h3>
          {skill.isNew && (
            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${NEW_BADGE_CLASS}`}>
              NEW
            </span>
          )}
        </div>
        <span className="shrink-0 ml-2 rounded-md bg-gray-800 px-2 py-0.5 text-xs font-mono text-gray-400">
          v{skill.version}
        </span>
      </div>

      <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-3">
        {truncatedDesc}
      </p>

      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${getCategoryBadgeClass(skill.category)}`}>
          <CategoryIcon category={skill.category} className="w-3 h-3" />
          {skill.category}
        </span>
        <span className="text-xs text-gray-500 group-hover:hidden transition-opacity">{skill.repoDisplayName}</span>
        <span className="text-xs text-indigo-400 hidden group-hover:inline-flex items-center gap-1 transition-opacity">
          View details
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
