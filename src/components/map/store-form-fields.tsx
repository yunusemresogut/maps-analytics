"use client";

import { useT } from "@/contexts/i18n-context";
import { useLocationTypes } from "@/hooks/use-location-types";
import { getProjectStatusOptions } from "@/lib/project-status";
import { clearFieldError, type FieldErrors } from "@/lib/validation";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
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

export function emptyStoreForm(locationType: LocationType): StoreFormData {
  return {
    name: "",
    city: "",
    address: "",
    projectStatus: "proje",
    openingDate: "",
    acceptanceDate: "",
    contractorCompany: "",
    siteManager: "",
    locationType,
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
  const { types: locationTypes, label: locationTypeLabel } = useLocationTypes();
  // Listeden kaldırılmış ya da eski bir tür kayıtlıysa seçenek olarak korunur
  const keepCurrent = form.locationType && !locationTypes.some((type) => type.key === form.locationType);

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
      <FormField label={t("site.fields.name")} required error={errors.name}>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={t("site.fields.namePlaceholder")}
          readOnly={readOnly}
          aria-invalid={!!errors.name}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("site.fields.status")} required>
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
        <FormField label={t("site.fields.locationType")} required>
          <Select
            value={form.locationType}
            onChange={(e) =>
              set("locationType", e.target.value as LocationType)
            }
            disabled={readOnly}
          >
            {keepCurrent && <option value={form.locationType}>{locationTypeLabel(form.locationType)}</option>}
            {locationTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("site.fields.openingDate")} required error={errors.openingDate}>
          <DatePicker
            value={form.openingDate}
            onChange={(value) => set("openingDate", value)}
            readOnly={readOnly}
            required
            aria-invalid={!!errors.openingDate}
          />
        </FormField>
        <FormField label={t("site.fields.acceptanceDate")} error={errors.acceptanceDate}>
          <DatePicker
            value={form.acceptanceDate}
            onChange={(value) => set("acceptanceDate", value)}
            readOnly={readOnly}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("site.fields.contractor")}>
          <Input
            value={form.contractorCompany}
            onChange={(e) => set("contractorCompany", e.target.value)}
            placeholder={t("site.fields.contractorPlaceholder")}
            readOnly={readOnly}
          />
        </FormField>
        <FormField label={t("site.fields.siteManager")}>
          <Input
            value={form.siteManager}
            onChange={(e) => set("siteManager", e.target.value)}
            placeholder={t("site.fields.siteManagerPlaceholder")}
            readOnly={readOnly}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("site.fields.grossM2")} required error={errors.grossM2}>
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
        <FormField label={t("site.fields.floorCount")} required error={errors.floorCount}>
          <Input
            type="number"
            min={1}
            value={form.floorCount}
            onChange={(e) => set("floorCount", e.target.value)}
            readOnly={readOnly}
            aria-invalid={!!errors.floorCount}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("site.fields.phone")} error={errors.phone}>
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
