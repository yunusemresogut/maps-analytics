"use client";

import { format, parseISO } from "date-fns";
import { useI18n, useT } from "@/contexts/i18n-context";
import { getProjectStatusLabel } from "@/lib/project-status";
import { useLocationTypes } from "@/hooks/use-location-types";
import type { Store } from "@/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-200">{value || "—"}</p>
    </div>
  );
}

type StoreViewFieldsProps = {
  store: Store;
};

export function StoreViewFields({ store }: StoreViewFieldsProps) {
  const t = useT();
  const { dateLocale } = useI18n();
  const { label: locationTypeLabel } = useLocationTypes();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={store.country && store.country !== "Türkiye" ? t("site.fields.cityArea") : t("site.fields.cityDistrict")}
          value={[
            [store.city, store.district].filter(Boolean).join(" / "),
            store.country && store.country !== "Türkiye" ? store.country : "",
          ]
            .filter(Boolean)
            .join(", ")}
        />
        <Field
          label={t("site.fields.status")}
          value={getProjectStatusLabel(store.projectStatus, t)}
        />
      </div>
      <Field label={t("site.fields.address")} value={store.address} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("site.fields.openingDate")}
          value={
            store.openingDate
              ? format(parseISO(store.openingDate), "d MMMM yyyy", {
                  locale: dateLocale,
                })
              : "—"
          }
        />
        <Field
          label={t("site.fields.acceptanceDate")}
          value={
            store.acceptanceDate
              ? format(parseISO(store.acceptanceDate), "d MMMM yyyy", {
                  locale: dateLocale,
                })
              : "—"
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("site.fields.contractor")} value={store.contractorCompany} />
        <Field label={t("site.fields.siteManager")} value={store.siteManager} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("site.fields.locationType")} value={locationTypeLabel(store.locationType)} />
        <Field label={t("site.fields.grossM2")} value={`${store.grossM2} m²`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("site.fields.floorCount")} value={store.floorCount} />
        <Field label={t("site.fields.phone")} value={store.phone} />
      </div>
    </div>
  );
}
