"use client";

import { projectStatusOptions } from "@/lib/project-status";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LocationType, ProjectStatus, Store } from "@/types";

export type StoreFormData = {
  name: string;
  city: string;
  address: string;
  projectStatus: ProjectStatus;
  openingDate: string;
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
    locationType: store.locationType,
    grossM2: String(store.grossM2),
    floorCount: String(store.floorCount),
    phone: store.phone ?? "",
  };
}

export function formToStoreData(
  form: StoreFormData,
  coords: { latitude: number; longitude: number },
  createdBy?: string
): Omit<Store, "id" | "isCustom"> {
  return {
    name: form.name.trim(),
    city: form.city.trim(),
    address: form.address.trim(),
    latitude: coords.latitude,
    longitude: coords.longitude,
    projectStatus: form.projectStatus,
    openingDate: form.openingDate,
    locationType: form.locationType,
    grossM2: Number(form.grossM2) || 0,
    floorCount: Number(form.floorCount) || 1,
    phone: form.phone.trim() || undefined,
    createdBy,
  };
}

type StoreFormFieldsProps = {
  form: StoreFormData;
  onChange: (form: StoreFormData) => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
      {children}
    </label>
  );
}

export function StoreFormFields({ form, onChange }: StoreFormFieldsProps) {
  const set = <K extends keyof StoreFormData>(key: K, value: StoreFormData[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Mağaza Adı</FieldLabel>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="LC Waikiki ..."
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Şehir</FieldLabel>
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="İstanbul"
            required
          />
        </div>
        <div>
          <FieldLabel>Durum</FieldLabel>
          <Select
            value={form.projectStatus}
            onChange={(e) => set("projectStatus", e.target.value as ProjectStatus)}
          >
            {projectStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <FieldLabel>Adres</FieldLabel>
        <Textarea
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Tam adres"
          className="min-h-[60px]"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Açılış Tarihi</FieldLabel>
          <Input
            type="date"
            value={form.openingDate}
            onChange={(e) => set("openingDate", e.target.value)}
            required
          />
        </div>
        <div>
          <FieldLabel>Konum Tipi</FieldLabel>
          <Select
            value={form.locationType}
            onChange={(e) => set("locationType", e.target.value as LocationType)}
          >
            <option value="avm">AVM</option>
            <option value="cadde">Cadde</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Brüt m²</FieldLabel>
          <Input
            type="number"
            min={0}
            value={form.grossM2}
            onChange={(e) => set("grossM2", e.target.value)}
            placeholder="1000"
            required
          />
        </div>
        <div>
          <FieldLabel>Kat Sayısı</FieldLabel>
          <Input
            type="number"
            min={1}
            value={form.floorCount}
            onChange={(e) => set("floorCount", e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <FieldLabel>Telefon (opsiyonel)</FieldLabel>
        <Input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+90 ..."
        />
      </div>
    </div>
  );
}
