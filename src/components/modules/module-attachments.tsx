"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { isAllowedFileType } from "@/lib/file-types";
import { Button } from "@/components/ui/button";
import type { ModuleAttachment } from "@/types";

type AttachmentRow = ModuleAttachment & {
  ticketId?: string;
  contractId?: string;
};

type ModuleAttachmentsProps = {
  table: "ticket_attachments" | "contract_attachments";
  parentId: string;
  parentField: "ticket_id" | "contract_id";
  bucket?: string;
  canEdit?: boolean;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapRow(row: Record<string, unknown>): AttachmentRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ticketId: row.ticket_id ? String(row.ticket_id) : undefined,
    contractId: row.contract_id ? String(row.contract_id) : undefined,
    name: String(row.name),
    size: Number(row.size || 0),
    type: String(row.type || ""),
    storagePath: String(row.storage_path),
    uploadedBy: String(row.uploaded_by),
    uploadedByName: String(row.uploaded_by_name),
    uploadedAt: String(row.uploaded_at),
  };
}

export function ModuleAttachments({
  table,
  parentId,
  parentField,
  bucket = "module-files",
  canEdit = true,
}: ModuleAttachmentsProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from(table)
      .select("*")
      .eq(parentField, parentId)
      .order("uploaded_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
      setItems([]);
    } else {
      setItems((data || []).map(mapRow));
    }
    setLoading(false);
  }, [table, parentField, parentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.organizationId) return;
    if (!isAllowedFileType(file.name)) {
      setError("Desteklenmeyen dosya türü");
      return;
    }
    setError("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `${parentId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      const row: Record<string, unknown> = {
        organization_id: user.organizationId,
        name: file.name,
        size: file.size,
        type: file.type,
        storage_path: publicUrl,
        uploaded_by: user.id,
        uploaded_by_name: user.name,
        [parentField]: parentId,
      };

      const { error: dbErr } = await supabase.from(table).insert(row);
      if (dbErr) throw dbErr;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme başarısız");
    }
  };

  const handleDelete = async (item: AttachmentRow) => {
    if (!confirm(`"${item.name}" silinsin mi?`)) return;
    const { error: dbErr } = await supabase
      .from(table)
      .delete()
      .eq("id", item.id);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Ekler
        </label>
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Yükle
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-zinc-600">Yükleniyor…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.length === 0 && (
            <li className="text-sm text-zinc-600">Henüz ek yok</li>
          )}
          {items.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-cyan-500/70" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-300">{file.name}</p>
                  <p className="text-xs text-zinc-600">
                    {file.uploadedByName} · {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = file.storagePath;
                    link.download = file.name;
                    link.target = "_blank";
                    link.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(file)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
