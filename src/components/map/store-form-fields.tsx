"use client";

import { useT } from "@/contexts/i18n-context";
import { getProjectStatusOptions } from "@/lib/project-status";
import { clearFieldError, type FieldErrors } from "@/lib/validation";
import { FormField } from "@/components/ui/form-field";
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
  errors?: FieldErrors;
  onErrorsChange?: (errors: FieldErrors) => void;
};

export function StoreFormFields({
  form,
  onChange,
  readOnly = false,
  errors = {},
  onErrorsChange,
}: StoreFormFieldsProps) {
  const t = useT();
  const statusOptions = getProjectStatusOptions(t);

  const set = <K extends keyof StoreFormData>(
    key: K,
    value: StoreFormData[K]
  ) => {
    onChange({ ...form, [key]: value });
    if (onErrorsChange && errors[key as string]) {
      onErrorsChange(clearFieldError(errors, key as string));
    }
  };

  return (
    <div className="space-y-3">
      <FormField label="Mağaza Adı" required error={errors.name}>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Mağaza adı..."
          readOnly={readOnly}
          aria-invalid={!!errors.name}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Şehir" required error={errors.city}>
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="İstanbul"
            readOnly={readOnly}
            aria-invalid={!!errors.city}
          />
        </FormField>
        <FormField label="Durum" required>
          <Select
            value={form.projectStatus}
            onChange={(e) =>
              set("projectStatus", e.target.value as ProjectStatus)
            }
            disabled={readOnly}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Adres" required error={errors.address}>
        <Textarea
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Tam adres"
          className="min-h-[60px]"
          readOnly={readOnly}
          aria-invalid={!!errors.address}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Açılış Tarihi" required error={errors.openingDate}>
          <Input
            type="date"
            value={form.openingDate}
            onChange={(e) => set("openingDate", e.target.value)}
            readOnly={readOnly}
            aria-invalid={!!errors.openingDate}
          />
        </FormField>
        <FormField label="Kabul Tarihi" error={errors.acceptanceDate}>
          <Input
            type="date"
            value={form.acceptanceDate}
            onChange={(e) => set("acceptanceDate", e.target.value)}
            readOnly={readOnly}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Yüklenici Firma">
          <Input
            value={form.contractorCompany}
            onChange={(e) => set("contractorCompany", e.target.value)}
            placeholder="Firma adı"
            readOnly={readOnly}
          />
        </FormField>
        <FormField label="Şantiye Şefi">
          <Input
            value={form.siteManager}
            onChange={(e) => set("siteManager", e.target.value)}
            placeholder="Ad Soyad"
            readOnly={readOnly}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Konum Tipi" required>
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
        </FormField>
        <FormField label="Brüt m²" required error={errors.grossM2}>
          <Input
            type="number"
            min={0}
            value={form.grossM2}
            onChange={(e) => set("grossM2", e.target.value)}
            placeholder="1000"
            readOnly={readOnly}
            aria-invalid={!!errors.grossM2}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Kat Sayısı" required error={errors.floorCount}>
          <Input
            type="number"
            min={1}
            value={form.floorCount}
            onChange={(e) => set("floorCount", e.target.value)}
            readOnly={readOnly}
            aria-invalid={!!errors.floorCount}
          />
        </FormField>
        <FormField label="Telefon" error={errors.phone}>
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+90 ..."
            readOnly={readOnly}
            aria-invalid={!!errors.phone}
          />
        </FormField>
      </div>
    </div>
  );
}
