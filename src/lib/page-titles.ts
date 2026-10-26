import type { TranslationKey } from "@/i18n";

export const SITE_NAME = "Koordine";

// Sayfa başlığı şablonu; root layout'taki metadata.title.template ile aynı olmalı
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

export function formatDocumentTitle(title?: string | null) {
  return title ? TITLE_TEMPLATE.replace("%s", title) : SITE_NAME;
}

// Pathname → başlık anahtarı. ":id" tek bir segmenti eşler.
const ROUTE_TITLES: [pattern: string, key: TranslationKey][] = [
  ["/login", "pageTitle.login"],
  ["/register", "pageTitle.register"],
  ["/dashboard", "pageTitle.dashboard"],
  ["/map", "pageTitle.map"],
  ["/stores", "pageTitle.stores"],
  ["/stores/:id", "pageTitle.stores"],
  ["/stores/:id/edit", "pageTitle.storeEdit"],
  ["/projects", "pageTitle.projects"],
  ["/approvals", "pageTitle.approvals"],
  ["/tickets", "pageTitle.tickets"],
  ["/tickets/new", "pageTitle.ticketNew"],
  ["/tickets/:id", "pageTitle.tickets"],
  ["/tickets/:id/edit", "pageTitle.ticketEdit"],
  ["/contracts", "pageTitle.contracts"],
  ["/contracts/new", "pageTitle.contractNew"],
  ["/contracts/:id/edit", "pageTitle.contractEdit"],
  ["/progress-payments", "pageTitle.progressPayments"],
  ["/progress-payments/new", "pageTitle.progressPaymentNew"],
  ["/progress-payments/:id/edit", "pageTitle.progressPaymentEdit"],
  ["/invoices", "pageTitle.invoices"],
  ["/invoices/new", "pageTitle.invoiceNew"],
  ["/invoices/:id/edit", "pageTitle.invoiceEdit"],
  ["/team", "pageTitle.team"],
  ["/reports", "pageTitle.reports"],
  ["/reports/daily-site", "pageTitle.dailySiteReport"],
  ["/reports/daily-site/:id", "pageTitle.dailySiteReport"],
  ["/inventory", "pageTitle.inventory"],
  ["/hr/personnel", "pageTitle.personnel"],
  ["/hr/personnel/:id", "pageTitle.personnel"],
  ["/hr/certificates", "pageTitle.certificates"],
  ["/hr/timesheets", "pageTitle.timesheets"],
  ["/hr/leaves", "pageTitle.leaves"],
  ["/hr/requests", "pageTitle.hrRequests"],
  ["/hr/announcements", "pageTitle.announcements"],
  ["/hr/reports", "pageTitle.hrReports"],
  ["/notifications", "pageTitle.notifications"],
  ["/settings/profile", "pageTitle.settingsProfile"],
  ["/settings/notifications", "pageTitle.settingsNotifications"],
  ["/settings/preferences", "pageTitle.settingsPreferences"],
  ["/settings/company", "pageTitle.settingsCompany"],
  ["/settings/notification-rules", "pageTitle.settingsNotificationRules"],
  ["/settings/modules", "pageTitle.settingsModules"],
  ["/admin/dashboard", "pageTitle.adminDashboard"],
  ["/admin/budgets", "pageTitle.adminBudgets"],
  ["/admin/users", "pageTitle.adminUsers"],
  ["/admin/regions", "pageTitle.adminRegions"],
  ["/admin/permissions", "pageTitle.adminPermissions"],
  ["/admin/logs", "pageTitle.adminLogs"],
];

const COMPILED = ROUTE_TITLES.map(
  ([pattern, key]) => [new RegExp(`^${pattern.replace(/:id/g, "[^/]+")}/?$`), key] as const
);

export function resolvePageTitleKey(pathname: string): TranslationKey | null {
  return COMPILED.find(([regex]) => regex.test(pathname))?.[1] ?? null;
}
