"use client";

import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import type { FilePreviewKind } from "@/lib/file-types";
import { useT } from "@/contexts/i18n-context";

export type FilePreview = {
  name: string;
  kind: FilePreviewKind;
  /** Yüklenirken null */
  url: string | null;
  onDownload?: () => void;
};

/** PDF, görsel ve video dosyalarını sayfadan çıkmadan gösterir */
export function FilePreviewModal({ preview, onClose }: { preview: FilePreview | null; onClose: () => void }) {
  const t = useT();
  return (
    <Modal
      open={!!preview}
      onClose={onClose}
      title={preview?.name ?? ""}
      className="sm:max-w-5xl"
      footer={
        preview?.onDownload && (
          <button
            type="button"
            onClick={preview.onDownload}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <Download className="h-4 w-4" />
            {t("finance.attachments.download")}
          </button>
        )
      }
    >
      {preview && (
        <div className="flex min-h-[50vh] items-center justify-center">
          {!preview.url ? (
            <Spinner />
          ) : preview.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- imzalı depo URL'si, optimize edilmez
            <img src={preview.url} alt={preview.name} className="max-h-[72vh] max-w-full rounded-lg object-contain" />
          ) : preview.kind === "video" ? (
            <video src={preview.url} controls className="max-h-[72vh] max-w-full rounded-lg" />
          ) : (
            <iframe src={preview.url} title={preview.name} className="h-[72vh] w-full rounded-lg border border-zinc-800 bg-white" />
          )}
        </div>
      )}
    </Modal>
  );
}
