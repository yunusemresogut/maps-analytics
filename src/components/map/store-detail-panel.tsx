"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Download,
  FileText,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useStoreData } from "@/contexts/store-data-context";
import { useStores } from "@/contexts/stores-context";
import { projectStatusConfig } from "@/lib/project-status";
import { getOpeningStatus, openingStatusConfig } from "@/lib/store-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  StoreFormFields,
  formToStoreData,
  storeToForm,
  type StoreFormData,
} from "@/components/map/store-form-fields";
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-200">{value}</p>
    </div>
  );
}

export function StoreDetailPanel({ store, onClose }: StoreDetailPanelProps) {
  const { user } = useAuth();
  const { updateStore, deleteStore } = useStores();
  const {
    getStoreData,
    addNote,
    deleteNote,
    updateSpecialNote,
    addFile,
    deleteFile,
  } = useStoreData();

  const [form, setForm] = useState<StoreFormData>(storeToForm(store));
  const [noteText, setNoteText] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(storeToForm(store));
    setSaved(false);
  }, [store]);

  const projectConfig = projectStatusConfig[store.projectStatus];
  const openingStatus = getOpeningStatus(store.openingDate);
  const openingConfig = openingStatusConfig[openingStatus];
  const userData = getStoreData(store.id);

  const handleSave = () => {
    updateStore(
      store.id,
      formToStoreData(form, {
        latitude: store.latitude,
        longitude: store.longitude,
      })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = () => {
    if (!store.isCustom) return;
    if (confirm("Bu konumu silmek istediğinize emin misiniz?")) {
      deleteStore(store.id);
      onClose();
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(store.id, noteText.trim());
    setNoteText("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addFile(store.id, file);
    e.target.value = "";
  };

  const handleDownload = (dataUrl: string, name: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = name;
    link.click();
  };

  if (!user) {
    return (
      <div className="absolute bottom-4 right-4 z-20 w-full max-w-md animate-in slide-in-from-right">
        <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/95 p-6 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-zinc-100">{store.name}</h3>
              <p className="mt-1 text-sm text-zinc-500">{store.city}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className={`${projectConfig.color} border border-current/20 bg-current/10`}>
              {projectConfig.label}
            </Badge>
            <Badge className={`${openingConfig.color} border border-current/20 bg-current/10`}>
              {openingConfig.label}
            </Badge>
            <Badge className="text-zinc-400 border border-zinc-600/30 bg-zinc-800/50">
              {store.locationType === "avm" ? "AVM" : "Cadde"}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <ReadOnlyField
              label="Açılış Tarihi"
              value={format(parseISO(store.openingDate), "d MMMM yyyy", { locale: tr })}
            />
            <ReadOnlyField label="Brüt m²" value={`${store.grossM2} m²`} />
            <ReadOnlyField label="Kat Sayısı" value={store.floorCount} />
            <ReadOnlyField label="Adres" value={store.address} />
          </div>

          <p className="mt-4 text-sm text-zinc-400">
            Düzenlemek, not ve dosya eklemek için giriş yapın.
          </p>
          <Link href="/login" className="mt-4 block">
            <Button className="w-full">Giriş Yap</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 flex max-h-[calc(100vh-6rem)] w-full max-w-md flex-col animate-in slide-in-from-right">
      <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-zinc-100">Mağaza Detayı</h3>
            {store.isCustom && (
              <Badge className="text-cyan-400 border border-cyan-500/20 bg-cyan-500/10">
                Yeni
              </Badge>
            )}
            {openingStatus === "opening_soon" && (
              <Badge className="text-red-400 border border-red-500/20 bg-red-500/10 animate-pulse">
                Yakında Açılıyor
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <StoreFormFields form={form} onChange={setForm} />

          <section>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Özel Not
            </label>
            <Textarea
              className="mt-2"
              placeholder="Kişisel notunuz..."
              value={userData.specialNote}
              onChange={(e) => updateSpecialNote(store.id, e.target.value)}
            />
            <p className="mt-1 text-xs text-zinc-600">
              Sadece sizin görebileceğiniz not
            </p>
          </section>

          <section>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Ek Notlar
            </label>
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
                      {format(parseISO(note.createdAt), "d MMM yyyy, HH:mm", {
                        locale: tr,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(store.id, note.id)}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Dosyalar
              </label>
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
                onChange={handleFileUpload}
              />
            </div>
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
                      <p className="truncate text-sm text-zinc-300">{file.name}</p>
                      <p className="text-xs text-zinc-600">
                        {formatFileSize(file.size)}
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteFile(store.id, file.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex gap-2 border-t border-zinc-800 p-4">
          {store.isCustom && (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </Button>
          )}
          <Button className="flex-1" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            {saved ? "Kaydedildi!" : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}
