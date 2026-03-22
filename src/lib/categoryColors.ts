export type CategoryType = "command" | "agent" | "skill";

interface CategoryStyle {
  badge: string;
  filterSelected: string;
  icon: string;
}

const categoryStyles: Record<CategoryType, CategoryStyle> = {
  command: {
    badge:
      "bg-amber-500/10 text-amber-400 border-amber-500/20",
    filterSelected:
      "bg-amber-600 text-white shadow-sm",
    icon: "terminal",
  },
  agent: {
    badge:
      "bg-purple-500/10 text-purple-400 border-purple-500/20",
    filterSelected:
      "bg-purple-600 text-white shadow-sm",
    icon: "cpu",
  },
  skill: {
    badge:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    filterSelected:
      "bg-emerald-600 text-white shadow-sm",
    icon: "zap",
  },
};

const fallback: CategoryStyle = {
  badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  filterSelected: "bg-indigo-600 text-white shadow-sm",
  icon: "box",
};

export function getCategoryBadgeClass(category: string): string {
  return (categoryStyles[category as CategoryType] ?? fallback).badge;
}

export function getCategoryFilterSelectedClass(category: string): string {
  return (categoryStyles[category as CategoryType] ?? fallback).filterSelected;
}

export function getCategoryIcon(category: string): string {
  return (categoryStyles[category as CategoryType] ?? fallback).icon;
}

export const NEW_BADGE_CLASS = "bg-rose-500/10 text-rose-400 border-rose-500/20";
