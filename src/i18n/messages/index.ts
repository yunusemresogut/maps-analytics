import { admin } from "@/i18n/messages/admin";
import { api } from "@/i18n/messages/api";
import { assistant } from "@/i18n/messages/assistant";
import { dashboard } from "@/i18n/messages/dashboard";
import { finance } from "@/i18n/messages/finance";
import { hr } from "@/i18n/messages/hr";
import { inventory } from "@/i18n/messages/inventory";
import { reports } from "@/i18n/messages/reports";
import { settings } from "@/i18n/messages/settings";
import { shell } from "@/i18n/messages/shell";
import { site } from "@/i18n/messages/site";
import { system } from "@/i18n/messages/system";
import { team } from "@/i18n/messages/team";

/**
 * Modül sözlükleri; her biri sözlükte kendi adıyla bir üst anahtardır
 * (ör. t("hr.leaves.title")). Yeni modül eklenince buraya da eklenir.
 */
export const messages = { admin, api, assistant, dashboard, finance, hr, inventory, reports, settings, shell, site, system, team };
