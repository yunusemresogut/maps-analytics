"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useT } from "@/contexts/i18n-context";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function AdminPageHeader({
  title,
  description,
  children,
}: AdminPageHeaderProps) {
  const { open, isPinned } = useSidebar();
  const t = useT();

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-md lg:hidden">
        {!isPinned && (
          <button
            type="button"
            onClick={open}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            aria-label={t("nav.openMenu")}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <h1 className="truncate text-sm font-medium text-zinc-200">{title}</h1>
      </div>
      <div className="border-b border-zinc-800/80 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="hidden text-xl font-semibold text-zinc-100 lg:block sm:text-2xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export function AdminPageBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`scrollbar-themed flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
