"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, FileArchive, FileImage, FileText, FileVideo, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { supabase } from "@/lib/supabase";
import {
  ATTACHMENT_PARENT_FIELDS,
  MODULE_FILES_BUCKET,
  attachmentObjectPath,
  getAttachmentUrl,
  uploadModuleAttachments,
  type AttachmentTable,
} from "@/lib/upload-module-attachment";
import {
  ALLOWED_FILE_ACCEPT,
  ALLOWED_FILE_LABELS,
  formatFileSize,
  getFilePreviewKind,
} from "@/lib/file-types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FilePreviewModal, type FilePreview } from "@/components/modules/file-preview-modal";
import type { ModuleAttachment } from "@/types";

type ModuleAttachmentsProps = {
  table: AttachmentTable;
  parentId: string;
  canEdit?: boolean;
};

function mapRow(row: Record<string, unknown>): ModuleAttachment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    size: Number(row.size || 0),
    type: String(row.type || ""),
    storagePath: String(row.storage_path),
    uploadedBy: String(row.uploaded_by),
    uploadedByName: String(row.uploaded_by_name),
    uploadedAt: String(row.uploaded_at),
  };
}

export function FileTypeIcon({ name, type }: { name: string; type: string }) {
  const kind = getFilePreviewKind(name, type);
  const className = "h-4 w-4 shrink-0 text-cyan-500/70";
  if (kind === "image") return <FileImage className={className} />;
  if (kind === "video") return <FileVideo className={className} />;
  if (/\.(zip|rar)$/i.test(name)) return <FileArchive className={className} />;
  return <FileText className={className} />;
}

async function downloadAttachment(file: ModuleAttachment) {
  const url = await getAttachmentUrl(file.storagePath, { download: file.name });
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.target = "_blank";
  link.click();
}

export function ModuleAttachments({ table, parentId, canEdit = true }: ModuleAttachmentsProps) {
  const { user } = useAuth();
  const t = useT();
  const parentField = ATTACHMENT_PARENT_FIELDS[table];
  const [items, setItems] = useState<ModuleAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<FilePreview | null>(null);
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !user?.organizationId) return;
    setError("");
    setUploading(true);
    const errors = await uploadModuleAttachments({ table, parentId, files, user });
    setUploading(false);
    if (errors.length > 0) setError(errors.join(" "));
    await load();
  };

  const handleDelete = async (item: ModuleAttachment) => {
    if (!confirm(t("finance.shared.deleteNamedConfirm", { name: item.name }))) return;
    const { error: dbErr } = await supabase.from(table).delete().eq("id", item.id);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    // Kayıt silindi; depodaki dosya da temizlenir (başarısız olursa sessizce kalır)
    void supabase.storage.from(MODULE_FILES_BUCKET).remove([attachmentObjectPath(item.storagePath)]);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  };

  const openPreview = async (file: ModuleAttachment) => {
    const kind = getFilePreviewKind(file.name, file.type);
    if (!kind) return;
    const onDownload = () => void downloadAttachment(file);
    setPreview({ name: file.name, kind, url: null, onDownload });
    const url = await getAttachmentUrl(file.storagePath);
    setPreview((current) => (current?.name === file.name ? { ...current, url } : current));
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t("finance.attachments.title")}</label>
        {canEdit && (
          <>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? t("finance.attachments.uploading") : t("finance.attachments.upload")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_FILE_ACCEPT}
              className="hidden"
              onChange={handleUpload}
            />
          </>
        )}
      </div>
      {canEdit && <p className="mt-1 text-[11px] text-zinc-600">{ALLOWED_FILE_LABELS} · {t("finance.attachments.maxSize")}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-zinc-600">{t("finance.attachments.loading")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.length === 0 && <li className="text-sm text-zinc-600">{t("finance.attachments.empty")}</li>}
          {items.map((file) => {
            const previewable = !!getFilePreviewKind(file.name, file.type);
            return (
              <li
                key={file.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
              >
                <button
                  type="button"
                  disabled={!previewable}
                  onClick={() => void openPreview(file)}
                  className="flex min-w-0 items-center gap-2 text-left enabled:hover:text-cyan-300 disabled:cursor-default"
                >
                  <FileTypeIcon name={file.name} type={file.type} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-300">{file.name}</p>
                    <p className="text-xs text-zinc-600">
                      {file.uploadedByName} · {formatFileSize(file.size)}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 gap-1">
                  {previewable && (
                    <Button size="icon" variant="ghost" onClick={() => void openPreview(file)} aria-label={t("finance.attachments.preview")} title={t("finance.attachments.preview")}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => void downloadAttachment(file)} aria-label={t("finance.attachments.download")} title={t("finance.attachments.download")}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(file)} aria-label={t("finance.attachments.delete")} title={t("finance.attachments.delete")}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FilePreviewModal preview={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
