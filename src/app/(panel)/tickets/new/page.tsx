"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { getRoleLabel } from "@/lib/roles";
import { nextTicketCode } from "@/lib/module-codes";
import { useSettings } from "@/contexts/settings-context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadModuleAttachments } from "@/lib/upload-module-attachment";
import { PendingAttachments } from "@/components/modules/pending-attachments";
import type { TicketPriority } from "@/types";

const PRIORITY_TR: Record<TicketPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

function NewTicketContent() {
  const router = useRouter();
  const { user, users, organization } = useAuth();
  const { tickets, createTicket } = useModules();
  const { stores } = useStores();
  const { canAdd } = usePermissions("tickets");
  const { org } = useSettings();

  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [storeId, setStoreId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saveError, setSaveError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const ticketCode = codeTouched ? code : nextTicketCode(tickets, org.defaults.ticketCodePrefix);
  const invalid = {
    code: !ticketCode.trim(),
    title: !title.trim(),
    store: !storeId,
    assignee: !users.some((u) => u.id === assigneeId),
  };

  if (!canAdd) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Ekleme yetkiniz yok
      </div>
    );
  }

  const save = async () => {
    if (createdTicketId) return;
    setShowErrors(true);
    const missing = [
      invalid.code && "Kod",
      invalid.title && "Başlık",
      invalid.store && "Saha",
      invalid.assignee && "Atanan",
    ].filter(Boolean);
    if (missing.length > 0) {
      setSaveError(`Zorunlu alanları doldurun: ${missing.join(", ")}`);
      return;
    }
    setSaveError("");
    setSaving(true);
    const assignee = users.find((u) => u.id === assigneeId);
    const id = await createTicket({
      title: title.trim(),
      code: ticketCode.trim(),
      description,
      priority,
      status: "open",
      storeId,
      assigneeId: assignee?.id,
      assigneeName: assignee?.name,
    });
    if (!id) {
      setSaving(false);
      setSaveError("Talep oluşturulamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      return;
    }

    setCreatedTicketId(id);
    if (attachments.length > 0 && user) {
      const errors = await uploadModuleAttachments({
        table: "ticket_attachments",
        parentId: id,
        files: attachments,
        user,
      });
      if (errors.length > 0) {
        setSaving(false);
        setSaveError(`Talep kaydedildi ancak bazı ekler yüklenemedi: ${errors.join(" ")}`);
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
      canSave={!createdTicketId}
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
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="text-xs text-zinc-500">Kod *</label>
            <Input
              className="mt-1 font-mono"
              value={ticketCode}
              aria-invalid={showErrors && invalid.code}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value);
              }}
            />
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs text-zinc-500">Başlık *</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={showErrors && invalid.title} />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Açıklama</label>
          <Textarea className="mt-1" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Saha *</label>
            <Select className="mt-1" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-invalid={showErrors && invalid.store}>
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
          <div>
            <label className="text-xs text-zinc-500">Atanan *</label>
            <Select className="mt-1" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-invalid={showErrors && invalid.assignee}>
              <option value="">Seçiniz</option>
              {sortedUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {getRoleLabel(u.role, organization)}</option>
              ))}
            </Select>
          </div>
        </div>
        <PendingAttachments files={attachments} onChange={setAttachments} />
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
