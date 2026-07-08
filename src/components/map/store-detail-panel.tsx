"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  Download,
  FileText,
  Package,
  Pencil,
  Save,
  ShoppingCart,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useStoreData } from "@/contexts/store-data-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { AuditLogSection } from "@/components/map/audit-log-section";
import { ExcelImportPanel } from "@/components/map/excel-import-panel";
import { ExcelWorkPlanImportPanel } from "@/components/map/excel-work-plan-import-panel";
import { MaterialsPanel } from "@/components/map/materials-panel";
import { WorkPlanPanel } from "@/components/map/work-plan-panel";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import {
  StoreFormFields,
  formToStoreData,
  storeToForm,
  type StoreFormData,
} from "@/components/map/store-form-fields";
import { StoreViewFields } from "@/components/map/store-view-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ALLOWED_FILE_ACCEPT, ALLOWED_FILE_LABELS } from "@/lib/file-types";
import { getOpeningAlert } from "@/lib/opening-dates";
import {
  projectStatusConfig,
  supportsExcelImport,
  supportsOrderReminder,
} from "@/lib/project-status";
import type { Store } from "@/types";

type StoreDetailPanelProps = {
  store: Store;
  onClose: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StoreDetailPanel({ store, onClose }: StoreDetailPanelProps) {
  const { user } = useAuth();
  const { canEdit, canDelete } = usePermissions();
  const { updateStore, deleteStore } = useStores();
  const {
    getStoreData,
    addNote,
    deleteNote,
    updateSpecialNote,
    addFile,
    deleteFile,
    importMaterials,
    deleteMaterial,
    clearMaterials,
    importWorkPlan,
    deleteWorkPlanItem,
    clearWorkPlan,
  } = useStoreData();

  const [isEditing, setIsEditing] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [workPlanOpen, setWorkPlanOpen] = useState(false);
  const [form, setForm] = useState<StoreFormData>(storeToForm(store));
  const [noteText, setNoteText] = useState("");
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(storeToForm(store));
    setIsEditing(false);
    setSaved(false);
    setMaterialsOpen(false);
    setWorkPlanOpen(false);
  }, [store]);

  const projectConfig = projectStatusConfig[store.projectStatus];
  const openingAlert = getOpeningAlert(store.openingDate);
  const userData = getStoreData(store.id);

  const handleSave = () => {
    if (!user || !canEdit) return;
    updateStore(
      store.id,
      formToStoreData(form, {
        latitude: store.latitude,
        longitude: store.longitude,
      }),
      { userId: user.id, userName: user.name }
    );
    setSaved(true);
    setIsEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancelEdit = () => {
    setForm(storeToForm(store));
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (confirm("Bu konumu silmek istediğinize emin misiniz?")) {
      deleteStore(store.id);
      onClose();
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !isEditing) return;
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

  const handleDownload = (dataUrl: string, name: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = name;
    link.click();
  };

  const handleMaterialImport = (rows: ParsedMaterialRow[]) => {
    if (!isEditing || rows.length === 0) return;
    importMaterials(store.id, rows, "replace");
    setMaterialsOpen(true);
  };

  const handleWorkPlanImport = (rows: ParsedWorkPlanRow[]) => {
    if (!isEditing || rows.length === 0) return;
    importWorkPlan(store.id, rows, "replace");
    setWorkPlanOpen(true);
  };

  const showMaterialsTab =
    supportsExcelImport(store.projectStatus) ||
    userData.materials.length > 0;

  const showWorkPlanTab =
    supportsExcelImport(store.projectStatus) ||
    userData.workPlan.length > 0;

  const hasSideTab = showMaterialsTab || showWorkPlanTab;

  const openMaterials = () => {
    setWorkPlanOpen(false);
    setMaterialsOpen(true);
  };

  const openWorkPlan = () => {
    setMaterialsOpen(false);
    setWorkPlanOpen(true);
  };

  return (
    <div className="absolute bottom-2 right-2 left-2 z-20 flex items-end animate-in sm:bottom-4 sm:left-auto sm:right-4">
      {materialsOpen ? (
        <MaterialsPanel
          storeId={store.id}
          materials={userData.materials}
          isEditing={isEditing}
          onClose={() => setMaterialsOpen(false)}
          onDelete={(id) => deleteMaterial(store.id, id)}
          onClear={() => clearMaterials(store.id)}
        />
      ) : workPlanOpen ? (
        <WorkPlanPanel
          storeId={store.id}
          items={userData.workPlan}
          isEditing={isEditing}
          onClose={() => setWorkPlanOpen(false)}
          onDelete={(id) => deleteWorkPlanItem(store.id, id)}
          onClear={() => clearWorkPlan(store.id)}
        />
      ) : (
        hasSideTab && (
          <div className="flex shrink-0 flex-col gap-1 self-end">
            {showMaterialsTab && (
              <button
                type="button"
                onClick={openMaterials}
                className="flex items-center gap-1.5 rounded-l-lg border border-r-0 border-zinc-700/60 bg-zinc-950/95 px-2.5 py-2.5 text-xs font-medium text-zinc-300 shadow-[-8px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-zinc-900 hover:text-cyan-300"
              >
                <ChevronLeft className="h-3 w-3" />
                <Package className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Malzemeler</span>
                {userData.materials.length > 0 && (
                  <span className="rounded-full bg-violet-500/20 px-1.5 text-[10px] text-violet-300">
                    {userData.materials.length}
                  </span>
                )}
              </button>
            )}
            {showWorkPlanTab && (
              <button
                type="button"
                onClick={openWorkPlan}
                className="flex items-center gap-1.5 rounded-l-lg border border-r-0 border-zinc-700/60 bg-zinc-950/95 px-2.5 py-2.5 text-xs font-medium text-zinc-300 shadow-[-8px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-zinc-900 hover:text-emerald-300"
              >
                <ChevronLeft className="h-3 w-3" />
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">İş Planı</span>
                {userData.workPlan.length > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">
                    {userData.workPlan.length}
                  </span>
                )}
              </button>
            )}
          </div>
        )
      )}

      <div
        className={`flex max-h-[calc(100vh-5rem)] w-full max-w-none shrink-0 flex-col overflow-hidden border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:max-h-[calc(100vh-6rem)] sm:max-w-md ${
          hasSideTab ? "rounded-r-xl rounded-l-none border-l-0" : "rounded-xl"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-zinc-100">
              {store.name}
            </h3>
            <Badge
              className={`${projectConfig.color} border border-current/20 bg-current/10`}
            >
              {projectConfig.label}
            </Badge>
            {openingAlert.isOpeningSoon && (
              <Badge className="text-red-400 border border-red-500/20 bg-red-500/10 animate-pulse">
                Yakında Açılıyor
              </Badge>
            )}
            {isEditing && (
              <Badge className="text-cyan-400 border border-cyan-500/20 bg-cyan-500/10">
                Düzenleniyor
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isEditing && canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Düzenle
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-themed flex-1 overflow-y-auto p-4 space-y-4">
          {openingAlert.isOpeningSoon && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-medium">{openingAlert.label}</p>
            </div>
          )}

          {openingAlert.isOverdue && store.projectStatus !== "acilis" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Açılış tarihi {openingAlert.daysSinceOpening} gün geçti
            </div>
          )}

          {supportsOrderReminder(store.projectStatus) && (
            <div className="flex items-center justify-between rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
              <div className="flex items-center gap-2 text-xs text-violet-300">
                <ShoppingCart className="h-4 w-4" />
                İhale kaydı — sipariş kontrolü gerekebilir
              </div>
              {isEditing && (
                <Button size="sm" variant="outline" className="text-xs" disabled>
                  Bunu Sipariş Et
                </Button>
              )}
            </div>
          )}

          {isEditing ? (
            <>
              <StoreFormFields form={form} onChange={setForm} />
              {supportsExcelImport(store.projectStatus) && (
                <>
                  <ExcelImportPanel onImport={handleMaterialImport} />
                  <ExcelWorkPlanImportPanel onImport={handleWorkPlanImport} />
                </>
              )}
            </>
          ) : (
            <StoreViewFields store={store} />
          )}

          <AuditLogSection audit={store} />

          <section>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Özel Not
            </label>
            {isEditing ? (
              <Textarea
                className="mt-2"
                placeholder="Kişisel notunuz..."
                value={userData.specialNote}
                onChange={(e) => updateSpecialNote(store.id, e.target.value)}
              />
            ) : (
              <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                {userData.specialNote || "—"}
              </p>
            )}
          </section>

          <section>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Notlar
            </label>
            {isEditing && (
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Yeni not ekle..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                />
                <Button size="sm" onClick={handleAddNote}>
                  Ekle
                </Button>
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {userData.notes.length === 0 && (
                <li className="text-sm text-zinc-600">Henüz not yok</li>
              )}
              {userData.notes.map((note) => (
                <li
                  key={note.id}
                  className="group flex items-start justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300">{note.content}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {note.userName} ·{" "}
                      {format(parseISO(note.createdAt), "d MMM yyyy, HH:mm", {
                        locale: tr,
                      })}
                    </p>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => deleteNote(store.id, note.id)}
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Dosyalar
              </label>
              {isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Yükle
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_ACCEPT}
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {fileError && (
              <p className="mt-1 text-xs text-red-400">{fileError}</p>
            )}
            <p className="mt-1 text-xs text-zinc-600">
              Kabul edilen: {ALLOWED_FILE_LABELS}
            </p>
            <ul className="mt-3 space-y-2">
              {userData.files.length === 0 && (
                <li className="text-sm text-zinc-600">Henüz dosya yok</li>
              )}
              {userData.files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
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
                      onClick={() => handleDownload(file.dataUrl, file.name)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isEditing && (
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
          </section>
        </div>

        {isEditing && (
          <div className="flex gap-2 border-t border-zinc-800 p-4">
            {canDelete && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Sil
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              İptal
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {saved ? "Kaydedildi!" : "Kaydet"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
