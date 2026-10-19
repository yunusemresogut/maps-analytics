"use client";

import Link from "next/link";
import { AlertTriangle, Check, CircleAlert, Loader2, X } from "lucide-react";
import type { ActionPreview } from "@/lib/assistant-actions";
import { cn } from "@/lib/utils";

export type ActionResult = { label: string; href?: string; ok: boolean };

export type ActionProposal = {
  status: "preparing" | "ready" | "running" | "done" | "cancelled";
  previews: ActionPreview[];
  results?: ActionResult[];
};

const MAX_TABLE_ROWS = 8;

function PreviewBlock({ preview }: { preview: ActionPreview }) {
  const hiddenRows = (preview.table?.rows.length ?? 0) - MAX_TABLE_ROWS;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{preview.title}</p>
      {preview.fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {preview.fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="text-zinc-500">{field.label}</dt>
              <dd className="min-w-0 break-words text-zinc-200">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.table && preview.table.rows.length > 0 && (
        <div className="scrollbar-themed overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-500">
              <tr>
                {preview.table.columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-2 py-1.5 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {preview.table.rows.slice(0, MAX_TABLE_ROWS).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={cn("px-2 py-1.5", cellIndex > 0 && "whitespace-nowrap")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenRows > 0 && (
            <p className="border-t border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-500">… ve {hiddenRows} kalem daha</p>
          )}
        </div>
      )}
      {preview.warnings.map((warning) => (
        <p key={warning} className="flex gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {warning}
        </p>
      ))}
      {preview.errors.map((error) => (
        <p key={error} className="flex gap-1.5 text-xs text-red-400">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ))}
    </div>
  );
}

/** Asistanın önerdiği kayıtların önizlemesi; onaylanmadan hiçbir şey eklenmez */
export function ActionPreviewCard({
  proposal,
  onConfirm,
  onCancel,
}: {
  proposal: ActionProposal;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (proposal.status === "preparing") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-xs text-zinc-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Önizleme hazırlanıyor…
      </div>
    );
  }

  const blocked = proposal.previews.some((preview) => preview.errors.length > 0);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      {proposal.previews.map((preview, index) => (
        <div key={index} className={cn(index > 0 && "border-t border-zinc-800 pt-3")}>
          <PreviewBlock preview={preview} />
        </div>
      ))}

      {proposal.status === "done" && proposal.results && (
        <ul className="space-y-1 border-t border-zinc-800 pt-3 text-xs">
          {proposal.results.map((result, index) => (
            <li key={index} className={cn("flex items-center gap-1.5", result.ok ? "text-emerald-400" : "text-red-400")}>
              {result.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {result.href ? (
                <Link href={result.href} className="underline-offset-2 hover:underline">
                  {result.label}
                </Link>
              ) : (
                result.label
              )}
            </li>
          ))}
        </ul>
      )}

      {proposal.status === "cancelled" && (
        <p className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">İptal edildi; hiçbir kayıt eklenmedi.</p>
      )}

      {(proposal.status === "ready" || proposal.status === "running") && (
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
          {blocked && (
            <p className="mr-auto text-xs text-zinc-500">Eksikleri sohbette düzeltin, yeni önizleme hazırlanır.</p>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={proposal.status === "running"}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
          >
            {blocked ? "Kapat" : "İptal"}
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={proposal.status === "running"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-on transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {proposal.status === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Onayla ve ekle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
