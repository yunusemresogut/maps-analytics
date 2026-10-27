"use client";

import { useRef, useState } from "react";
import { Eye, Paperclip, X } from "lucide-react";
import {
  ALLOWED_FILE_ACCEPT,
  ALLOWED_FILE_LABELS,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  getFilePreviewKind,
  isAllowedFileType,
} from "@/lib/file-types";
import { FileTypeIcon } from "@/components/modules/module-attachments";
import { useT } from "@/contexts/i18n-context";
import { FilePreviewModal, type FilePreview } from "@/components/modules/file-preview-modal";

/**
 * Kayıt oluşturulmadan önce seçilen ekler: kayıt kaydedilince
 * uploadModuleAttachments ile yüklenir. Seçim sırasında önizlenebilir.
 */
export function PendingAttachments({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<FilePreview | null>(null);

  const add = (selected: File[]) => {
    const rejected = selected.filter((file) => !isAllowedFileType(file.name) || file.size > MAX_ATTACHMENT_BYTES);
    setError(
      rejected.length > 0
        ? t("finance.attachments.rejected", { files: rejected.map((file) => file.name).join(", ") })
        : ""
    );
    const accepted = selected.filter((file) => !rejected.includes(file));
    onChange([...files, ...accepted.filter((file) => !files.some((f) => f.name === file.name && f.size === file.size))]);
  };

  const openPreview = (file: File) => {
    const kind = getFilePreviewKind(file.name, file.type);
    if (kind) setPreview({ name: file.name, kind, url: URL.createObjectURL(file) });
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
          {t("finance.attachments.chooseFile")}
        </button>
        <span className="min-w-0 truncate text-xs text-zinc-500">{ALLOWED_FILE_LABELS} · {t("finance.attachments.maxSize")}</span>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, index) => {
            const previewable = !!getFilePreviewKind(file.name, file.type);
            return (
              <li
                key={`${file.name}-${file.size}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileTypeIcon name={file.name} type={file.type} />
                  <span className="truncate text-sm text-zinc-300">{file.name}</span>
                  <span className="shrink-0 text-xs text-zinc-600">{formatFileSize(file.size)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {previewable && (
                    <button
                      type="button"
                      onClick={() => openPreview(file)}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                      aria-label={t("finance.attachments.preview")}
                      title={t("finance.attachments.preview")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(files.filter((_, i) => i !== index))}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                    aria-label={t("finance.attachments.remove")}
                    title={t("finance.attachments.remove")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FilePreviewModal preview={preview} onClose={closePreview} />
    </div>
  );
}
