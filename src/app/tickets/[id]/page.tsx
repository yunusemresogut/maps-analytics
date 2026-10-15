"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleAttachments } from "@/components/modules/module-attachments";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useT } from "@/contexts/i18n-context";
import type { TicketPriority, TicketStatus } from "@/types";

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  resolved: "Çözüldü",
  closed: "Kapalı",
};

function TicketDetail({ id }: { id: string }) {
  const { tickets } = useModules();
  const { stores } = useStores();
  const { canEdit } = usePermissions("tickets");
  const t = useT();
  const ticket = tickets.find((item) => item.id === id);

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("common.noData")}
      </div>
    );
  }

  const store = stores.find((item) => item.id === ticket.storeId);

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/tickets" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" />
            Tadilat Talepleri
          </Link>
                        {canEdit && (
                          <Link
                            href={`/tickets/${id}/edit`}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Düzenle
                          </Link>
                        )}
        </div>

        <header className="border-b border-zinc-800 pb-5">
          <p className="font-mono text-xs text-cyan-400/90">{ticket.code ?? "Tadilat talebi"}</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{ticket.title}</h1>
          {store && (
            <Link href={`/stores/${store.id}`} className="mt-2 inline-block text-sm text-cyan-400 hover:underline">
              {store.name}
            </Link>
          )}
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">Durum</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">{STATUS_LABELS[ticket.status]}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Öncelik</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">{PRIORITY_LABELS[ticket.priority]}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Oluşturan</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">{ticket.createdByName}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Oluşturulma</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.createdAt))}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-200">Açıklama</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {ticket.description || "Açıklama eklenmemiş."}
          </p>
        </section>

        <ModuleAttachments
          table="ticket_attachments"
          parentId={id}
          parentField="ticket_id"
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="tickets">
      <TicketDetail id={id} />
    </AuthGuard>
  );
}
