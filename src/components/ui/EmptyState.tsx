"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950/20 py-12">
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mb-4">
        <Icon className="h-6 w-6 shrink-0" />
      </div>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">{title}</h3>
      <p className="text-sm text-zinc-400 dark:text-zinc-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors duration-200 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
