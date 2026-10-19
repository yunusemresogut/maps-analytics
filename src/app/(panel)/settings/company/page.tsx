"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { VAT_RATE_OPTIONS } from "@/lib/module-finance";
import { formatTry } from "@/lib/currency";
import { clearFieldError, hasErrors, validateProfile, type FieldErrors } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { SaveIndicator, SettingsPageHeader, SettingsSection, useAutoSave } from "@/components/settings/settings-ui";

function CompanyInfoSection() {
  const { organization, updateOrganization } = useAuth();
  const { state, run } = useAutoSave();
  const [form, setForm] = useState({
    name: organization?.name ?? "",
    taxNumber: organization?.taxNumber ?? "",
    authorizedPerson: organization?.authorizedPerson ?? "",
    phone: organization?.phone ?? "",
    address: organization?.address ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const field = (key: keyof typeof form, errorKey: string = key) => ({
    value: form[key],
    "aria-invalid": Boolean(errors[errorKey]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setErrors((prev) => clearFieldError(prev, errorKey));
    },
  });

  const save = () => {
    const nextErrors = validateProfile({
      name: "-",
      companyName: form.name,
      taxNumber: form.taxNumber,
      authorizedPerson: form.authorizedPerson,
      orgPhone: form.phone,
      address: form.address,
      requireOrg: true,
    });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    void run(() =>
      updateOrganization({
        name: form.name.trim(),
        taxNumber: form.taxNumber.trim(),
        authorizedPerson: form.authorizedPerson.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      })
    );
  };

  return (
    <SettingsSection title="Firma bilgileri" action={<SaveIndicator state={state} />}>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <FormField label="Firma adı" required error={errors.companyName} className="sm:col-span-2">
          <Input {...field("name", "companyName")} />
        </FormField>
        <FormField label="Vergi numarası" required error={errors.taxNumber}>
          <Input {...field("taxNumber")} />
        </FormField>
        <FormField label="Yetkili kişi" required error={errors.authorizedPerson}>
          <Input {...field("authorizedPerson")} />
        </FormField>
        <FormField label="Telefon" required error={errors.orgPhone}>
          <Input {...field("phone", "orgPhone")} />
        </FormField>
        <FormField label="Adres" required error={errors.address} className="sm:col-span-2">
          <Textarea rows={3} {...field("address")} />
        </FormField>
        <div className="sm:col-span-2">
          <Button onClick={save} loading={state === "saving"}>
            Kaydet
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

function DefaultsSection() {
  const { org, updateOrgSettings } = useSettings();
  const { state, run } = useAutoSave();
  const [form, setForm] = useState({
    storeBudget: String(org.defaults.storeBudget),
    ticketCodePrefix: org.defaults.ticketCodePrefix,
    contractCodePrefix: org.defaults.contractCodePrefix,
    vatRate: org.defaults.vatRate,
  });
  const budget = Number(form.storeBudget);
  const budgetInvalid = !form.storeBudget.trim() || !Number.isFinite(budget) || budget < 0;

  const save = () => {
    if (budgetInvalid) return;
    void run(() =>
      updateOrgSettings({
        defaults: {
          storeBudget: budget,
          ticketCodePrefix: form.ticketCodePrefix,
          contractCodePrefix: form.contractCodePrefix,
          vatRate: form.vatRate,
        },
      })
    );
  };

  const prefixInput = (key: "ticketCodePrefix" | "contractCodePrefix") => ({
    value: form[key],
    maxLength: 6,
    className: "font-mono uppercase",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })),
  });

  return (
    <SettingsSection
      title="Varsayılanlar"
      description="Yeni kayıtlarda önerilen değerler; kayıt sırasında değiştirilebilir."
      action={<SaveIndicator state={state} />}
    >
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <FormField
          label="Yeni mağaza bütçesi (TRY)"
          error={budgetInvalid ? "Geçerli bir tutar girin." : undefined}
          hint={budgetInvalid ? undefined : formatTry(budget)}
        >
          <Input
            type="number"
            min={0}
            value={form.storeBudget}
            aria-invalid={budgetInvalid}
            onChange={(e) => setForm((prev) => ({ ...prev, storeBudget: e.target.value }))}
          />
        </FormField>
        <FormField label="Fatura KDV oranı">
          <Select
            value={form.vatRate}
            onChange={(e) => setForm((prev) => ({ ...prev, vatRate: Number(e.target.value) }))}
          >
            {VAT_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                %{rate}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Ticket kod öneki"
          hint={`Örnek: ${form.ticketCodePrefix || "TT"}-0001`}
        >
          <Input {...prefixInput("ticketCodePrefix")} />
        </FormField>
        <FormField
          label="Sözleşme kod öneki"
          hint={`Örnek: ${form.contractCodePrefix || "SZ"}-0001`}
        >
          <Input {...prefixInput("contractCodePrefix")} />
        </FormField>
        <div className="sm:col-span-2">
          <Button onClick={save} loading={state === "saving"} disabled={budgetInvalid}>
            Kaydet
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

export default function CompanySettingsPage() {
  return (
    <AuthGuard routeKey="adminSettings">
      <div className="space-y-6">
        <SettingsPageHeader title="Firma ve varsayılanlar" description="Firma bilgileri ve yeni kayıtlarda kullanılan varsayılan değerler." />
        <CompanyInfoSection />
        <DefaultsSection />
      </div>
    </AuthGuard>
  );
}
