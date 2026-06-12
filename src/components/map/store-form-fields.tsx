"use client";

import { projectStatusOptions } from "@/lib/project-status";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LocationType, ProjectStatus, Store, StoreInput } from "@/types";

export type StoreFormData = {
  name: string;
  city: string;
  address: string;
  projectStatus: ProjectStatus;
  openingDate: string;
  acceptanceDate: string;
  contractorCompany: string;
  siteManager: string;
  locationType: LocationType;
  grossM2: string;
  floorCount: string;
  phone: string;
};

export function emptyStoreForm(): StoreFormData {
  return {
    name: "",
    city: "",
    address: "",
    projectStatus: "proje",
    openingDate: "",
    acceptanceDate: "",
    contractorCompany: "",
    siteManager: "",
    locationType: "avm",
    grossM2: "",
    floorCount: "1",
    phone: "",
  };
}

export function storeToForm(store: Store): StoreFormData {
  return {
    name: store.name,
    city: store.city,
    address: store.address,
    projectStatus: store.projectStatus,
    openingDate: store.openingDate,
    acceptanceDate: store.acceptanceDate ?? "",
    contractorCompany: store.contractorCompany ?? "",
    siteManager: store.siteManager ?? "",
    locationType: store.locationType,
    grossM2: String(store.grossM2),
    floorCount: String(store.floorCount),
    phone: store.phone ?? "",
  };
}

export function formToStoreData(
  form: StoreFormData,
  coords: { latitude: number; longitude: number }
): StoreInput {
  return {
    name: form.name.trim(),
    city: form.city.trim(),
    address: form.address.trim(),
    latitude: coords.latitude,
    longitude: coords.longitude,
    projectStatus: form.projectStatus,
    openingDate: form.openingDate,
    acceptanceDate: form.acceptanceDate.trim() || undefined,
    contractorCompany: form.contractorCompany.trim() || undefined,
    siteManager: form.siteManager.trim() || undefined,
    locationType: form.locationType,
    grossM2: Number(form.grossM2) || 0,
    floorCount: Number(form.floorCount) || 1,
    phone: form.phone.trim() || undefined,
  };
}

type StoreFormFieldsProps = {
  form: StoreFormData;
  onChange: (form: StoreFormData) => void;
  readOnly?: boolean;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
      {children}
    </label>
  );
}

export function StoreFormFields({
  form,
  onChange,
  readOnly = false,
}: StoreFormFieldsProps) {
  const set = <K extends keyof StoreFormData>(
    key: K,
    value: StoreFormData[K]
  ) => onChange({ ...form, [key]: value });

  const field = (
    label: string,
    input: React.ReactNode
  ) => (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {input}
    </div>
  );

  return (
    <div className="space-y-3">
      {field(
        "Mağaza Adı",
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Mağaza adı..."
          required
          readOnly={readOnly}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {field(
          "Şehir",
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="İstanbul"
            required
            readOnly={readOnly}
          />
        )}
        {field(
          "Durum",
          <Select
            value={form.projectStatus}
            onChange={(e) =>
              set("projectStatus", e.target.value as ProjectStatus)
            }
            disabled={readOnly}
          >
            {projectStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {field(
        "Adres",
        <Textarea
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Tam adres"
          className="min-h-[60px]"
          required
          readOnly={readOnly}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {field(
          "Açılış Tarihi",
          <Input
            type="date"
            value={form.openingDate}
            onChange={(e) => set("openingDate", e.target.value)}
            required
            readOnly={readOnly}
          />
        )}
        {field(
          "Kabul Tarihi",
          <Input
            type="date"
            value={form.acceptanceDate}
            onChange={(e) => set("acceptanceDate", e.target.value)}
            readOnly={readOnly}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field(
          "Yüklenici Firma",
          <Input
            value={form.contractorCompany}
            onChange={(e) => set("contractorCompany", e.target.value)}
            placeholder="Firma adı"
            readOnly={readOnly}
          />
        )}
        {field(
          "Şantiye Şefi",
          <Input
            value={form.siteManager}
            onChange={(e) => set("siteManager", e.target.value)}
            placeholder="Ad Soyad"
            readOnly={readOnly}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field(
          "Konum Tipi",
          <Select
            value={form.locationType}
            onChange={(e) =>
              set("locationType", e.target.value as LocationType)
            }
            disabled={readOnly}
          >
            <option value="avm">AVM</option>
            <option value="cadde">Cadde</option>
          </Select>
        )}
        {field(
          "Brüt m²",
          <Input
            type="number"
            min={0}
            value={form.grossM2}
            onChange={(e) => set("grossM2", e.target.value)}
            placeholder="1000"
            required
            readOnly={readOnly}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field(
          "Kat Sayısı",
          <Input
            type="number"
            min={1}
            value={form.floorCount}
            onChange={(e) => set("floorCount", e.target.value)}
            required
            readOnly={readOnly}
          />
        )}
        {field(
          "Telefon (opsiyonel)",
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+90 ..."
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
}
