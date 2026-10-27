import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Coins,
  FileBadge,
  FileClock,
  CalendarCheck,
  Car,
  Inbox,
  Megaphone,
  MessageSquare,
  Receipt,
  ShoppingCart,
  Ticket,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { NOTIFICATION_TYPES } from "@/lib/settings";
import { t } from "@/i18n/runtime";
import type { NotificationType } from "@/types";

type NotificationMeta = { icon: LucideIcon; color: string; label: string };

/** Etiket her okunuşta seçili dile çevrilir */
function meta(type: NotificationType, icon: LucideIcon, color: string): NotificationMeta {
  return {
    icon,
    color,
    get label() {
      return t(`system.notificationType.${type}`);
    },
  };
}

/** Bildirim türlerinin panel ve sayfadaki görünümü */
export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  opening_soon: meta("opening_soon", AlertTriangle, "text-red-400"),
  opening_overdue: meta("opening_overdue", Clock, "text-amber-400"),
  ihale_contract_reminder: meta("ihale_contract_reminder", ShoppingCart, "text-violet-400"),
  contract_expiring: meta("contract_expiring", CalendarClock, "text-violet-400"),
  ticket_assigned: meta("ticket_assigned", UserCheck, "text-cyan-400"),
  ticket_high_priority: meta("ticket_high_priority", Ticket, "text-red-400"),
  payment_pending_approval: meta("payment_pending_approval", Receipt, "text-emerald-400"),
  invoice_unpaid: meta("invoice_unpaid", Coins, "text-amber-400"),
  team_unread: meta("team_unread", MessageSquare, "text-cyan-400"),
  certificate_expiring: meta("certificate_expiring", FileClock, "text-amber-400"),
  certificate_pending: meta("certificate_pending", FileBadge, "text-teal-400"),
  leave_pending: meta("leave_pending", CalendarClock, "text-sky-400"),
  leave_decided: meta("leave_decided", CalendarCheck, "text-emerald-400"),
  announcement_unread: meta("announcement_unread", Megaphone, "text-cyan-400"),
  hr_request_pending: meta("hr_request_pending", Inbox, "text-sky-400"),
  hr_request_decided: meta("hr_request_decided", Inbox, "text-emerald-400"),
  vehicle_expiring: meta("vehicle_expiring", Car, "text-amber-400"),
};

export function notificationModule(type: NotificationType) {
  return NOTIFICATION_TYPES.find((item) => item.type === type)!.module;
}
