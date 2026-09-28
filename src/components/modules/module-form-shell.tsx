"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type ModuleFormShellProps = {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  saveLabel?: string;
  canSave?: boolean;
  canDelete?: boolean;
};

export function ModuleFormShell({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
  onSave,
  onDelete,
  saving,
  saveLabel = "Kaydet",
  canSave = true,
  canDelete = false,
}: ModuleFormShellProps) {
  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>

      <div className="w-full space-y-6">{children}</div>

      {(canSave || canDelete) && (onSave || onDelete) && (
        <div className="mt-8 flex flex-wrap gap-2">
          {canSave && onSave && (
            <Button onClick={onSave} loading={saving}>
              {saveLabel}
            </Button>
          )}
          {canDelete && onDelete && (
            <Button variant="danger" onClick={onDelete}>
              Sil
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
