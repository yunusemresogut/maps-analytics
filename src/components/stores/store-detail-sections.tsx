"use client";

import { useRef, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import {
  Download,
  FileText,
  MessageSquare,
  StickyNote,
  Lock,
  Trash2,
  Upload,
} from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { useStoreData } from "@/contexts/store-data-context";
import { usePermissions } from "@/hooks/use-permissions";
import { MaterialsPanel } from "@/components/map/materials-panel";
import { WorkPlanPanel } from "@/components/map/work-plan-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ALLOWED_FILE_ACCEPT, ALLOWED_FILE_LABELS } from "@/lib/file-types";
import { getAttachmentUrl } from "@/lib/upload-module-attachment";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import { cn } from "@/lib/utils";
import type { Store } from "@/types";
import { usePrivateNote } from "@/hooks/use-private-note";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Kullanıcının bu mağaza için kendi notu (başkaları göremez) */
function PrivateNoteSection({ storeId }: { storeId: string }) {
  const { note, loading, loadError, save } = usePrivateNote(storeId);
  if (loading) return <p className="text-sm text-zinc-500">Yükleniyor…</p>;
  if (loadError) return <p className="text-sm text-red-400">Not yüklenemedi. Sayfayı yenileyin.</p>;
  return <SpecialNoteEditor saved={note} onSave={save} />;
}

/**
 * Özel not: yazarken yalnızca yerel taslak değişir; "Kaydet" ile tek istekte
 * kaydedilir. Başka biri notu değiştirirse ve burada kaydedilmemiş değişiklik
 * yoksa taslak güncel değere çekilir.
 */
function SpecialNoteEditor({
  saved,
  onSave,
}: {
  saved: string;
  onSave: (note: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = draft !== saved;

  if (saved !== lastSaved) {
    setLastSaved(saved);
    if (draft === lastSaved) setDraft(saved);
  }

  const save = async () => {
    if (!dirty || status === "saving") return;
    setStatus("saving");
    const ok = await onSave(draft);
    setStatus(ok ? "saved" : "error");
    if (ok) window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
  };

  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-30 resize-y"
        placeholder="Bu mağaza için kendinize not alın…"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (status !== "saving") setStatus("idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void save();
          }
        }}
        aria-label="Özel not"
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          role="status"
          className={cn(
            "mr-auto text-xs",
            status === "error" ? "text-red-400" : status === "saved" ? "text-emerald-400" : "text-zinc-500"
          )}
        >
          {status === "error"
            ? "Kaydedilemedi. Tekrar deneyin."
            : status === "saved"
              ? "Kaydedildi"
              : dirty
                ? "Kaydedilmemiş değişiklik var"
                : ""}
        </span>
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            disabled={status === "saving"}
            onClick={() => {
              setDraft(saved);
              setStatus("idle");
            }}
          >
            Vazgeç
          </Button>
        )}
        <Button size="sm" disabled={!dirty} loading={status === "saving"} onClick={() => void save()}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-cyan-500/80" />}
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        </div>
        {action}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StoreDetailSections({ store }: { store: Store }) {
  const { dateLocale } = useI18n();
  const { canEdit } = usePermissions("stores");
  const {
    getStoreData,
    addNote,
    deleteNote,
    addFile,
    deleteFile,
    importMaterials,
    deleteMaterial,
    importWorkPlan,
    deleteWorkPlanItem,
  } = useStoreData();

  const userData = getStoreData(store.id);
  const [noteText, setNoteText] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddNote = () => {
    if (!noteText.trim() || !canEdit) return;
    addNote(store.id, noteText.trim());
    setNoteText("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    const result = await addFile(store.id, file);
    if (!result.success) setFileError(result.error ?? "Yükleme başarısız");
    e.target.value = "";
  };

  const handleMaterialImport = (rows: ParsedMaterialRow[]) => {
    if (!canEdit || rows.length === 0) return;
    importMaterials(store.id, rows, "replace");
  };

  const handleWorkPlanImport = (rows: ParsedWorkPlanRow[]) => {
    if (!canEdit || rows.length === 0) return;
    importWorkPlan(store.id, rows, "replace");
  };

  return (
    <div className="space-y-6">
      <WorkPlanPanel
        storeId={store.id}
        isEditing={canEdit}
        onDelete={(ids) => deleteWorkPlanItem(store.id, ids)}
        onImport={handleWorkPlanImport}
      />

      <MaterialsPanel
        storeId={store.id}
        isEditing={canEdit}
        onDelete={(ids) => deleteMaterial(store.id, ids)}
        onImport={handleMaterialImport}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <SectionCard
            title="Özel Not"
            icon={StickyNote}
            action={
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                <Lock className="h-3 w-3" aria-hidden />
                Yalnızca siz görürsünüz
              </span>
            }
          >
            <PrivateNoteSection key={store.id} storeId={store.id} />
          </SectionCard>

          <SectionCard
            title="Dosyalar"
            icon={FileText}
            action={
              canEdit ? (
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
                    accept={ALLOWED_FILE_ACCEPT}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </>
              ) : undefined
            }
            bodyClassName="max-h-[320px] overflow-y-auto"
          >
            {fileError && (
              <p className="mb-2 text-xs text-red-400">{fileError}</p>
            )}
            <p className="mb-3 text-xs text-zinc-600">
              {ALLOWED_FILE_LABELS}
            </p>
            <ul className="space-y-2">
              {userData.files.length === 0 && (
                <li className="rounded-lg border border-dashed border-zinc-800 py-6 text-center text-sm text-zinc-600">
                  Henüz dosya yok
                </li>
              )}
              {userData.files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-cyan-500/70" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-300">
                        {file.name}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {file.userName} · {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        // Depo gizli: kısa ömürlü imzalı bağlantıyla indirilir
                        const link = document.createElement("a");
                        link.href = await getAttachmentUrl(file.dataUrl, {
                          bucket: "store-files",
                          download: file.name,
                        });
                        link.download = file.name;
                        link.click();
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteFile(store.id, file.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          title="Notlar"
          icon={MessageSquare}
          className="lg:min-h-full"
          bodyClassName="flex min-h-[280px] flex-col"
        >
          {canEdit && (
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Ekip notu ekle…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
              />
              <Button size="sm" className="shrink-0" onClick={handleAddNote}>
                Ekle
              </Button>
            </div>
          )}
          <ul className="scrollbar-themed flex-1 space-y-2 overflow-y-auto pr-1">
            {userData.notes.length === 0 && (
              <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-800 py-10 text-sm text-zinc-600">
                Henüz not yok
              </li>
            )}
            {userData.notes.map((note) => (
              <li
                key={note.id}
                className="group flex items-start justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {note.content}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-600">
                    {note.userName} ·{" "}
                    {format(parseISO(note.createdAt), "d MMM yyyy, HH:mm", {
                      locale: dateLocale,
                    })}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => deleteNote(store.id, note.id)}
                    className="shrink-0 rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Notu sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
