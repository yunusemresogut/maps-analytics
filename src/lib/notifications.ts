import { differenceInCalendarDays, parseISO } from "date-fns";
import { getIntlLocale, t } from "@/i18n/runtime";
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
import { CERTIFICATE_TYPE_LABELS, formatHours, type Certificate } from "@/lib/hr";
import { LEAVE_TYPE_LABELS, canDecide, type LeaveRequest } from "@/lib/leaves";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, type Announcement, type PersonnelRequest } from "@/lib/hr-admin";
import { nearestVehicleDocument, type InventoryItem } from "@/lib/inventory";
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
  /** Süresi geçmiş / yaklaşan ve onay bekleyen belgeler (RLS: yetkisizse yalnızca kendi belgeleri) */
  certificates: Certificate[];
  /** Bekleyen ve kullanıcının son sonuçlanan izin talepleri */
  leaves: LeaveRequest[];
  announcements: Announcement[];
  /** Bekleyen ve kullanıcının son sonuçlanan personel talepleri */
  requests: PersonnelRequest[];
  /** Belgesi eşik gününe kadar biten araçlar (RLS: yetkisizse yalnızca zimmetindekiler) */
  vehicles: InventoryItem[];
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
        message:
          until === 0
            ? t("system.notification.openingToday", { name: store.name })
            : t(until === 1 ? "system.notification.openingInOne" : "system.notification.openingInOther", { name: store.name, days: until }),
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
        message: t(alert.daysSinceOpening === 1 ? "system.notification.openingOverdueOne" : "system.notification.openingOverdueOther", {
          name: store.name,
          days: alert.daysSinceOpening,
        }),
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
        message: t("system.notification.tenderContract", { name: store.name }),
        createdAt: now,
        read: false,
        actionHref: `/contracts/new?storeId=${store.id}`,
        actionLabel: t("system.notificationAction.createContract"),
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
        message:
          until === 0
            ? t("system.notification.contractEndsToday", { name: contract.code ?? contract.title })
            : t(until === 1 ? "system.notification.contractEndsInOne" : "system.notification.contractEndsInOther", {
                name: contract.code ?? contract.title,
                days: until,
              }),
        createdAt: contract.updatedAt ?? contract.createdAt,
        read: false,
        actionHref: `/contracts/${contract.id}/edit`,
        actionLabel: t("system.notificationAction.openContract"),
      });
    }
  }

  if (can("tickets")) {
    for (const ticket of input.tickets) {
      const active = ticket.status === "open" || ticket.status === "in_progress";
      const assignedToMe = ticket.assigneeId === user.id;
      const ticketLabel = `${ticket.code ? `${ticket.code} · ` : ""}${ticket.title}`;
      const base = {
        storeId: ticket.storeId,
        storeName: storeName(ticket.storeId),
        createdAt: ticket.updatedAt ?? ticket.createdAt,
        read: false,
        actionHref: `/tickets/${ticket.id}`,
        actionLabel: t("system.notificationAction.openTicket"),
      };
      if (shown.has("ticket_assigned") && active && assignedToMe) {
        notifications.push({
          ...base,
          id: `notif-ticket-assigned-${ticket.id}`,
          type: "ticket_assigned",
          message: t("system.notification.ticketAssigned", { ticket: ticketLabel }),
        });
      } else if (shown.has("ticket_high_priority") && ticket.status === "open" && ticket.priority === "high") {
        notifications.push({
          ...base,
          id: `notif-ticket-high-${ticket.id}`,
          type: "ticket_high_priority",
          message: t("system.notification.ticketHighPriority", { ticket: ticketLabel }),
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
        message: t("system.notification.paymentPending", { title: payment.title }),
        createdAt: payment.updatedAt ?? payment.createdAt,
        read: false,
        actionHref: `/progress-payments/${payment.id}/edit`,
        actionLabel: t("system.notificationAction.openPayment"),
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
        message: t("system.notification.invoiceUnpaid", { number: invoice.invoiceNumber }),
        createdAt: invoice.issuedAt ?? invoice.createdAt,
        read: false,
        actionHref: `/invoices/${invoice.id}/edit`,
        actionLabel: t("system.notificationAction.openInvoice"),
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
      const name = input.users.find((member) => member.id === senderId)?.name ?? t("system.notification.teamMemberFallback");
      notifications.push({
        // Yeni mesaj gelince kapatılmış bildirim yeniden görünür
        id: `notif-team-${senderId}-${last.id}`,
        type: "team_unread",
        message: t(count === 1 ? "system.notification.teamUnreadOne" : "system.notification.teamUnreadOther", { name, count }),
        createdAt: last.createdAt,
        read: false,
        actionHref: `/team?peer=${senderId}`,
        actionLabel: t("system.notificationAction.openChat"),
      });
    }
  }

  if (org.modules.hr) {
    const seen = new Set<string>();
    for (const certificate of input.certificates) {
      if (seen.has(certificate.id)) continue;
      seen.add(certificate.id);
      const label = certificate.name || CERTIFICATE_TYPE_LABELS[certificate.type];
      const href = `/hr/personnel/${certificate.personnelId}`;

      const left = daysUntil(certificate.expiresAt);
      if (
        shown.has("certificate_expiring") &&
        certificate.personnelActive &&
        left !== null &&
        left <= org.notifications.certificateExpiryDays
      ) {
        notifications.push({
          // Belge yenilenince (bitiş değişince) bildirim yeniden görünür
          id: `notif-cert-expiry-${certificate.id}-${certificate.expiresAt}`,
          type: "certificate_expiring",
          message:
            left < 0
              ? t(-left === 1 ? "system.notification.certificateExpiredOne" : "system.notification.certificateExpiredOther", {
                  person: certificate.personnelName,
                  label,
                  days: -left,
                })
              : left === 0
                ? t("system.notification.certificateExpiresToday", { person: certificate.personnelName, label })
                : t(left === 1 ? "system.notification.certificateExpiresInOne" : "system.notification.certificateExpiresInOther", {
                    person: certificate.personnelName,
                    label,
                    days: left,
                  }),
          createdAt: now,
          read: false,
          actionHref: href,
          actionLabel: t("system.notificationAction.openPersonnel"),
        });
      }

      if (shown.has("certificate_pending") && !certificate.verified && canModule(user, "personnel", "edit")) {
        notifications.push({
          id: `notif-cert-pending-${certificate.id}`,
          type: "certificate_pending",
          message: t("system.notification.certificatePending", { person: certificate.personnelName, label }),
          createdAt: now,
          read: false,
          actionHref: href,
          actionLabel: t("system.notificationAction.reviewDocument"),
        });
      }
    }

    const seenLeaves = new Set<string>();
    for (const leave of input.leaves) {
      if (seenLeaves.has(leave.id)) continue;
      seenLeaves.add(leave.id);
      const period = t(leave.dayCount === 1 ? "system.notification.leavePeriodOne" : "system.notification.leavePeriodOther", {
        type: LEAVE_TYPE_LABELS[leave.type],
        days: formatHours(leave.dayCount),
      });
      if (
        shown.has("leave_pending") &&
        canDecide(leave, user, canModule(user, "leaves", "edit")) &&
        // İK, yönetici adımındaki talepler için bildirim almaz (yöneticisi var)
        (leave.status === "pending_hr" || leave.managerId === user.id)
      ) {
        notifications.push({
          // Yönetici onayından sonra İK için yeniden görünür
          id: `notif-leave-pending-${leave.id}-${leave.status}`,
          type: "leave_pending",
          message: t("system.notification.leavePending", { person: leave.personnelName, period }),
          createdAt: leave.managerDecidedAt ?? leave.createdAt,
          read: false,
          actionHref: "/hr/leaves",
          actionLabel: t("system.notificationAction.reviewRequest"),
        });
      }
      if (shown.has("leave_decided") && leave.personnelUserId === user.id && (leave.status === "approved" || leave.status === "rejected")) {
        notifications.push({
          id: `notif-leave-decided-${leave.id}-${leave.status}`,
          type: "leave_decided",
          message: t(leave.status === "approved" ? "system.notification.leaveApproved" : "system.notification.leaveRejected", { period }),
          createdAt: leave.hrDecidedAt ?? leave.managerDecidedAt ?? leave.createdAt,
          read: false,
          actionHref: "/hr/leaves",
          actionLabel: t("system.notificationAction.myLeaves"),
        });
      }
    }

    if (shown.has("announcement_unread")) {
      for (const announcement of input.announcements) {
        notifications.push({
          id: `notif-announcement-${announcement.id}`,
          type: "announcement_unread",
          message: announcement.requiresAck
            ? t("system.notification.announcementAck", { title: announcement.title })
            : announcement.title,
          createdAt: announcement.publishAt,
          read: false,
          actionHref: "/hr/announcements",
          actionLabel: t("system.notificationAction.readAnnouncement"),
        });
      }
    }

    const isRequestHr = canModule(user, "hrRequests", "edit");
    for (const request of input.requests) {
      const own = request.personnelUserId === user.id;
      const label = `${REQUEST_TYPE_LABELS[request.type].split(" (")[0]}: ${request.title}`;
      if (shown.has("hr_request_pending") && request.status === "pending" && isRequestHr && !own) {
        notifications.push({
          id: `notif-request-pending-${request.id}`,
          type: "hr_request_pending",
          message: `${request.personnelName} · ${label}`,
          createdAt: request.createdAt,
          read: false,
          actionHref: "/hr/requests",
          actionLabel: t("system.notificationAction.reviewRequest"),
        });
      }
      if (shown.has("hr_request_decided") && own && ["approved", "rejected", "completed"].includes(request.status)) {
        notifications.push({
          id: `notif-request-decided-${request.id}-${request.status}`,
          type: "hr_request_decided",
          message: `${label} — ${REQUEST_STATUS_LABELS[request.status].toLocaleLowerCase(getIntlLocale())}`,
          createdAt: request.completedAt ?? request.decidedAt ?? request.createdAt,
          read: false,
          actionHref: "/hr/requests",
          actionLabel: t("system.notificationAction.myRequests"),
        });
      }
    }
  }

  if (shown.has("vehicle_expiring")) {
    for (const vehicle of input.vehicles) {
      const doc = nearestVehicleDocument(vehicle);
      const left = doc ? daysUntil(doc.date) : null;
      if (!doc || left === null || left > org.notifications.vehicleExpiryDays) continue;
      const name = [vehicle.serialNo, vehicle.name].filter(Boolean).join(" · ");
      const docLabel = doc.label.toLocaleLowerCase(getIntlLocale());
      notifications.push({
        // Belge yenilenince (tarih değişince) yeniden görünür
        id: `notif-vehicle-${vehicle.id}-${doc.label}-${doc.date}`,
        type: "vehicle_expiring",
        message:
          left < 0
            ? t(-left === 1 ? "system.notification.vehicleExpiredOne" : "system.notification.vehicleExpiredOther", {
                name,
                doc: docLabel,
                days: -left,
              })
            : left === 0
              ? t("system.notification.vehicleExpiresToday", { name, doc: docLabel })
              : t(left === 1 ? "system.notification.vehicleExpiresInOne" : "system.notification.vehicleExpiresInOther", {
                  name,
                  doc: docLabel,
                  days: left,
                }),
        createdAt: now,
        read: false,
        actionHref: "/inventory",
        actionLabel: t("system.notificationAction.goToInventory"),
      });
    }
  }

  return notifications;
}

/** Bildirime tıklanınca gidilecek adres */
export function notificationHref(notification: AppNotification): string {
  return notification.actionHref ?? `/map?store=${notification.storeId ?? ""}`;
}
