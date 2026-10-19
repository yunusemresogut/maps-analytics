import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  AppNotification,
  Contract,
  Invoice,
  ProgressPayment,
  Store,
  TeamMessage,
  Ticket,
  User,
} from "@/types";
import { getOpeningAlert } from "@/lib/opening-dates";
import { needsContractWarning } from "@/lib/module-finance";
import { canModule } from "@/lib/permissions";
import {
  NOTIFICATION_TYPES,
  isNotificationShown,
  notificationState,
  type OrgSettings,
  type UserPreferences,
} from "@/lib/settings";

type NotificationInput = {
  user: Pick<User, "id" | "role" | "permissions">;
  org: OrgSettings;
  prefs: UserPreferences;
  stores: Store[];
  contracts: Contract[];
  tickets: Ticket[];
  progressPayments: ProgressPayment[];
  invoices: Invoice[];
  teamMessages: TeamMessage[];
  users: Pick<User, "id" | "name">[];
};

function daysUntil(date: string): number | null {
  if (!date) return null;
  const parsed = parseISO(date);
  return Number.isNaN(parsed.getTime()) ? null : differenceInCalendarDays(parsed, new Date());
}

/**
 * Kullanıcının görebildiği verilerden bildirimleri üretir. Firma kuralı,
 * kullanıcı tercihi ve modül görüntüleme yetkisi birlikte uygulanır.
 */
export function computeNotifications(input: NotificationInput): AppNotification[] {
  const { user, org, prefs } = input;
  const shown = new Set(
    NOTIFICATION_TYPES.filter((item) => isNotificationShown(notificationState(item.type, item.module, org, prefs))).map(
      (item) => item.type
    )
  );
  const can = (module: Parameters<typeof canModule>[1]) => canModule(user, module, "view");
  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();
  const storeName = (id?: string) => input.stores.find((store) => store.id === id)?.name;

  const canSeeStores = can("map") || can("stores");
  for (const store of canSeeStores ? input.stores : []) {
    const alert = getOpeningAlert(store.openingDate);
    const until = daysUntil(store.openingDate);

    if (shown.has("opening_soon") && until !== null && until >= 0 && until <= org.notifications.openingSoonDays) {
      notifications.push({
        id: `notif-soon-${store.id}`,
        type: "opening_soon",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: ${until === 0 ? "Bugün açılıyor" : `${until} gün sonra açılıyor`}`,
        createdAt: now,
        read: false,
      });
    }

    if (shown.has("opening_overdue") && alert.isOverdue && store.projectStatus !== "acilis") {
      notifications.push({
        id: `notif-overdue-${store.id}`,
        type: "opening_overdue",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: Açılış tarihi ${alert.daysSinceOpening} gün geçti`,
        createdAt: now,
        read: false,
      });
    }

    if (
      shown.has("ihale_contract_reminder") &&
      can("contracts") &&
      needsContractWarning(store.projectStatus, store.id, input.contracts)
    ) {
      notifications.push({
        id: `notif-ihale-contract-${store.id}`,
        type: "ihale_contract_reminder",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: İhale durumunda — sözleşmenizi oluşturun`,
        createdAt: now,
        read: false,
        actionHref: `/contracts/new?storeId=${store.id}`,
        actionLabel: "Sözleşme oluştur",
      });
    }
  }

  if (shown.has("contract_expiring") && can("contracts")) {
    for (const contract of input.contracts) {
      if (contract.status !== "active" || !contract.endDate) continue;
      const until = daysUntil(contract.endDate);
      if (until === null || until < 0 || until > org.notifications.contractExpiryDays) continue;
      notifications.push({
        // Bitiş tarihi değişirse yeniden bildirilsin
        id: `notif-contract-expiring-${contract.id}-${contract.endDate}`,
        type: "contract_expiring",
        storeId: contract.storeId,
        storeName: storeName(contract.storeId),
        message: `${contract.code ?? contract.title}: ${until === 0 ? "bugün sona eriyor" : `${until} gün sonra sona eriyor`}`,
        createdAt: contract.updatedAt ?? contract.createdAt,
        read: false,
        actionHref: `/contracts/${contract.id}/edit`,
        actionLabel: "Sözleşmeyi aç",
      });
    }
  }

  if (can("tickets")) {
    for (const ticket of input.tickets) {
      const active = ticket.status === "open" || ticket.status === "in_progress";
      const assignedToMe = ticket.assigneeId === user.id;
      const base = {
        storeId: ticket.storeId,
        storeName: storeName(ticket.storeId),
        createdAt: ticket.updatedAt ?? ticket.createdAt,
        read: false,
        actionHref: `/tickets/${ticket.id}`,
        actionLabel: "Talebi aç",
      };
      if (shown.has("ticket_assigned") && active && assignedToMe) {
        notifications.push({
          ...base,
          id: `notif-ticket-assigned-${ticket.id}`,
          type: "ticket_assigned",
          message: `${ticket.code ? `${ticket.code} · ` : ""}${ticket.title} size atandı`,
        });
      } else if (shown.has("ticket_high_priority") && ticket.status === "open" && ticket.priority === "high") {
        notifications.push({
          ...base,
          id: `notif-ticket-high-${ticket.id}`,
          type: "ticket_high_priority",
          message: `${ticket.code ? `${ticket.code} · ` : ""}${ticket.title} — yüksek öncelikli, açık`,
        });
      }
    }
  }

  // Onay bekleyen hakedişler yalnızca onaylayabilecek (düzenleme yetkili) kişilere
  if (shown.has("payment_pending_approval") && canModule(user, "progressPayments", "edit")) {
    for (const payment of input.progressPayments) {
      if (payment.status !== "submitted") continue;
      notifications.push({
        id: `notif-payment-${payment.id}`,
        type: "payment_pending_approval",
        storeId: payment.storeId,
        storeName: storeName(payment.storeId),
        message: `${payment.title} onay bekliyor`,
        createdAt: payment.updatedAt ?? payment.createdAt,
        read: false,
        actionHref: `/progress-payments/${payment.id}/edit`,
        actionLabel: "Hakedişi aç",
      });
    }
  }

  if (shown.has("invoice_unpaid") && can("invoices")) {
    for (const invoice of input.invoices) {
      if (invoice.status !== "issued") continue;
      notifications.push({
        id: `notif-invoice-${invoice.id}`,
        type: "invoice_unpaid",
        storeId: invoice.storeId,
        storeName: storeName(invoice.storeId),
        message: `${invoice.invoiceNumber} numaralı fatura ödenmedi`,
        createdAt: invoice.issuedAt ?? invoice.createdAt,
        read: false,
        actionHref: `/invoices/${invoice.id}/edit`,
        actionLabel: "Faturayı aç",
      });
    }
  }

  if (shown.has("team_unread")) {
    const latestBySender = new Map<string, { count: number; last: TeamMessage }>();
    for (const message of input.teamMessages) {
      if (message.recipientId !== user.id || message.readAt) continue;
      const entry = latestBySender.get(message.senderId);
      latestBySender.set(message.senderId, {
        count: (entry?.count ?? 0) + 1,
        last: !entry || message.createdAt > entry.last.createdAt ? message : entry.last,
      });
    }
    for (const [senderId, { count, last }] of latestBySender) {
      const name = input.users.find((member) => member.id === senderId)?.name ?? "Bir ekip üyesi";
      notifications.push({
        // Yeni mesaj gelince kapatılmış bildirim yeniden görünür
        id: `notif-team-${senderId}-${last.id}`,
        type: "team_unread",
        message: `${name}: ${count} okunmamış mesaj`,
        createdAt: last.createdAt,
        read: false,
        actionHref: `/team?peer=${senderId}`,
        actionLabel: "Sohbeti aç",
      });
    }
  }

  return notifications;
}

/** Bildirime tıklanınca gidilecek adres */
export function notificationHref(notification: AppNotification): string {
  return notification.actionHref ?? `/map?store=${notification.storeId ?? ""}`;
}
