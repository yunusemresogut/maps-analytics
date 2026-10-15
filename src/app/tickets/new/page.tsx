"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { nextTicketCode } from "@/lib/module-codes";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadModuleAttachment } from "@/lib/upload-module-attachment";
import { ALLOWED_FILE_ACCEPT, ALLOWED_FILE_LABELS } from "@/lib/file-types";
import type { TicketPriority } from "@/types";

const PRIORITY_TR: Record<TicketPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

function NewTicketContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { tickets, createTicket } = useModules();
  const { stores } = useStores();
  const { canAdd } = usePermissions("tickets");

  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [storeId, setStoreId] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [saveError, setSaveError] = useState("");
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const ticketCode = codeTouched ? code : nextTicketCode(tickets);

  if (!canAdd) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Ekleme yetkiniz yok
      </div>
    );
  }

  const save = async () => {
    if (!title.trim() || createdTicketId) return;
    setSaveError("");
    setSaving(true);
    const id = await createTicket({
      title: title.trim(),
      code: ticketCode.trim() || undefined,
      description,
      priority,
      status: "open",
      storeId: storeId || undefined,
    });
    if (!id) {
      setSaving(false);
      setSaveError("Talep oluşturulamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      return;
    }

    setCreatedTicketId(id);
    if (attachment && user) {
      const result = await uploadModuleAttachment({
        table: "ticket_attachments",
        parentId: id,
        parentField: "ticket_id",
        file: attachment,
        user,
      });
      if (!result.ok) {
        setSaving(false);
        setSaveError(`Talep kaydedildi ancak ek yüklenemedi: ${result.error}`);
        return;
      }
    }
    router.push("/tickets");
  };

  return (
    <ModuleFormShell
      backHref="/tickets"
      backLabel="Tadilat Talepleri"
      title="Yeni tadilat talebi"
      onSave={save}
      saving={saving}
      saveLabel="Oluştur"
      canSave={!!title.trim() && !createdTicketId}
    >
      {saveError && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {saveError}
          {createdTicketId && (
            <Link href={`/tickets/${createdTicketId}`} className="ml-2 underline underline-offset-2">
              Talep detayını aç
            </Link>
          )}
        </p>
      )}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Kod</label>
            <Input
              className="mt-1 font-mono"
              value={ticketCode}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Başlık *</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Açıklama</label>
          <Textarea className="mt-1" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Mağaza</label>
            <Select className="mt-1" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Seçiniz</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Öncelik</label>
            <Select className="mt-1" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {Object.entries(PRIORITY_TR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <input
            ref={attachmentInputRef}
            type="file"
            accept={ALLOWED_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300"
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              Ek dosya seç
            </button>
            <span className="min-w-0 truncate text-xs text-zinc-500">
              {attachment?.name ?? ALLOWED_FILE_LABELS}
            </span>
          </div>
        </div>
      </div>
    </ModuleFormShell>
  );
}

export default function NewTicketPage() {
  return (
    <AuthGuard routeKey="tickets">
      <NewTicketContent />
    </AuthGuard>
  );
}
