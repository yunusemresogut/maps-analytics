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
import type { NotificationType } from "@/types";

/** Bildirim türlerinin panel ve sayfadaki görünümü */
export const NOTIFICATION_META: Record<NotificationType, { icon: LucideIcon; color: string; label: string }> = {
  opening_soon: { icon: AlertTriangle, color: "text-red-400", label: "Yakında Açılış" },
  opening_overdue: { icon: Clock, color: "text-amber-400", label: "Açılış Gecikmesi" },
  ihale_contract_reminder: { icon: ShoppingCart, color: "text-violet-400", label: "Sözleşme Gerekli" },
  contract_expiring: { icon: CalendarClock, color: "text-violet-400", label: "Sözleşme Bitiyor" },
  ticket_assigned: { icon: UserCheck, color: "text-cyan-400", label: "Size Atanan Talep" },
  ticket_high_priority: { icon: Ticket, color: "text-red-400", label: "Yüksek Öncelikli Talep" },
  payment_pending_approval: { icon: Receipt, color: "text-emerald-400", label: "Onay Bekleyen Hakediş" },
  invoice_unpaid: { icon: Coins, color: "text-amber-400", label: "Ödenmemiş Fatura" },
  team_unread: { icon: MessageSquare, color: "text-cyan-400", label: "Yeni Mesaj" },
  certificate_expiring: { icon: FileClock, color: "text-amber-400", label: "Belge Süresi" },
  certificate_pending: { icon: FileBadge, color: "text-teal-400", label: "Onay Bekleyen Belge" },
  leave_pending: { icon: CalendarClock, color: "text-sky-400", label: "Onay Bekleyen İzin" },
  leave_decided: { icon: CalendarCheck, color: "text-emerald-400", label: "İzin Sonucu" },
  announcement_unread: { icon: Megaphone, color: "text-cyan-400", label: "Duyuru" },
  hr_request_pending: { icon: Inbox, color: "text-sky-400", label: "Bekleyen Talep" },
  hr_request_decided: { icon: Inbox, color: "text-emerald-400", label: "Talep Sonucu" },
  vehicle_expiring: { icon: Car, color: "text-amber-400", label: "Araç Belgesi" },
};

export function notificationModule(type: NotificationType) {
  return NOTIFICATION_TYPES.find((item) => item.type === type)!.module;
}
