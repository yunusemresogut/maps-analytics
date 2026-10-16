"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleAttachments } from "@/components/modules/module-attachments";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TicketPriority, TicketStatus } from "@/types";

const PRIORITY_TR: Record<TicketPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

const STATUS_TR: Record<TicketStatus, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  resolved: "Çözüldü",
  closed: "Kapalı",
};

function EditTicketContent({ id }: { id: string }) {
  const router = useRouter();
  const { tickets, updateTicket, deleteTicket } = useModules();
  const { stores } = useStores();
  const { canEdit, canDelete } = usePermissions("tickets");
  const t = useT();
  const ticket = tickets.find((x) => x.id === id);

  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [storeId, setStoreId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setTitle(ticket.title);
    setCode(ticket.code ?? "");
    setDescription(ticket.description);
    setPriority(ticket.priority);
    setStatus(ticket.status);
    setStoreId(ticket.storeId ?? "");
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("common.noData")}
      </div>
    );
  }

  const store = stores.find((s) => s.id === ticket.storeId);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    await updateTicket(id, {
      title: title.trim(),
      code: code.trim() || undefined,
      description,
      priority,
      status,
      storeId: storeId || undefined,
    });
    setSaving(false);
    router.push("/tickets");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Bu tadilat talebi silinsin mi?")) return;
    await deleteTicket(id);
    router.push("/tickets");
  };

  return (
    <ModuleFormShell
      backHref="/tickets"
      backLabel="Tadilat Talepleri"
      title={ticket.code ?? "Tadilat talebi düzenle"}
      subtitle={store ? store.name : undefined}
      onSave={save}
      onDelete={remove}
      saving={saving}
      canSave={canEdit}
      canDelete={canDelete}
    >
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        {store && (
          <Link href={`/stores/${store.id}`} className="text-sm text-cyan-400 hover:underline">
            Mağaza: {store.name}
          </Link>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Kod</label>
            <Input
              className="mt-1 font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Başlık</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Açıklama</label>
          <Textarea className="mt-1" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Mağaza</label>
            <Select className="mt-1" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={!canEdit}>
              <option value="">Seçiniz</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Öncelik</label>
            <Select className="mt-1" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} disabled={!canEdit}>
              {Object.entries(PRIORITY_TR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} disabled={!canEdit}>
              {Object.entries(STATUS_TR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <ModuleAttachments
        table="ticket_attachments"
        parentId={id}
        parentField="ticket_id"
        canEdit={canEdit}
      />
    </ModuleFormShell>
  );
}

export default function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="tickets">
      <EditTicketContent id={id} />
    </AuthGuard>
  );
}
