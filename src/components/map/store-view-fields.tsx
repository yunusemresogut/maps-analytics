"use client";

import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { projectStatusConfig } from "@/lib/project-status";
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
  const status = projectStatusConfig[store.projectStatus];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Şehir" value={store.city} />
        <Field label="Durum" value={status.label} />
      </div>
      <Field label="Adres" value={store.address} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Açılış Tarihi"
          value={
            store.openingDate
              ? format(parseISO(store.openingDate), "d MMMM yyyy", {
                  locale: tr,
                })
              : "—"
          }
        />
        <Field
          label="Kabul Tarihi"
          value={
            store.acceptanceDate
              ? format(parseISO(store.acceptanceDate), "d MMMM yyyy", {
                  locale: tr,
                })
              : "—"
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Yüklenici Firma" value={store.contractorCompany} />
        <Field label="Şantiye Şefi" value={store.siteManager} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Konum Tipi"
          value={store.locationType === "avm" ? "AVM" : "Cadde"}
        />
        <Field label="Brüt m²" value={`${store.grossM2} m²`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kat Sayısı" value={store.floorCount} />
        <Field label="Telefon" value={store.phone} />
      </div>
    </div>
  );
}
