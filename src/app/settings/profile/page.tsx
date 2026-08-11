"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useT } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/field-error";
import { isAdmin } from "@/lib/roles";
import {
  clearFieldError,
  hasErrors,
  validateProfile,
  type FieldErrors,
} from "@/lib/validation";

function ProfileContent() {
  const { user, organization, updateProfile, updateOrganization } = useAuth();
  const t = useT();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [companyName, setCompanyName] = useState(organization?.name ?? "");
  const [taxNumber, setTaxNumber] = useState(organization?.taxNumber ?? "");
  const [authorizedPerson, setAuthorizedPerson] = useState(
    organization?.authorizedPerson ?? ""
  );
  const [orgPhone, setOrgPhone] = useState(organization?.phone ?? "");
  const [address, setAddress] = useState(organization?.address ?? "");
  const [avatarUrl, setAvatarUrl] = useState(
    organization?.avatarUrl ?? user?.avatarUrl ?? ""
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [user]);

  useEffect(() => {
    setCompanyName(organization?.name ?? "");
    setTaxNumber(organization?.taxNumber ?? "");
    setAuthorizedPerson(organization?.authorizedPerson ?? "");
    setOrgPhone(organization?.phone ?? "");
    setAddress(organization?.address ?? "");
    setAvatarUrl(organization?.avatarUrl ?? user?.avatarUrl ?? "");
  }, [organization, user?.avatarUrl]);

  const touch = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    setFieldErrors((prev) => clearFieldError(prev, key));
  };

  const save = async () => {
    setMessage("");
    setError("");
    const requireOrg = Boolean(user && isAdmin(user.role));
    const errors = validateProfile({
      name,
      phone,
      companyName,
      taxNumber,
      authorizedPerson,
      orgPhone,
      address,
      avatarUrl,
      requireOrg,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSaving(true);
    const okUser = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      avatarUrl: avatarUrl.trim() || undefined,
    });
    let okOrg = true;
    if (requireOrg) {
      okOrg = await updateOrganization({
        name: companyName.trim(),
        taxNumber: taxNumber.trim(),
        authorizedPerson: authorizedPerson.trim(),
        phone: orgPhone.trim(),
        address: address.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
    }
    setSaving(false);
    if (okUser && okOrg) setMessage(t("profile.saved"));
    else setError("Kayıt sırasında bir hata oluştu");
  };

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">
          {t("profile.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("profile.description")}</p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">
            {t("profile.userInfo")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label={t("auth.fullName")}
              required
              error={fieldErrors.name}
            >
              <Input
                value={name}
                onChange={(e) => touch("name", e.target.value, setName)}
                aria-invalid={!!fieldErrors.name}
              />
            </FormField>
            <FormField label={t("auth.email")} required>
              <Input value={user?.email ?? ""} disabled />
            </FormField>
            <FormField label={t("profile.phone")} error={fieldErrors.phone}>
              <Input
                value={phone}
                onChange={(e) => touch("phone", e.target.value, setPhone)}
                aria-invalid={!!fieldErrors.phone}
              />
            </FormField>
          </div>
        </section>

        {user && isAdmin(user.role) && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-200">
              {t("profile.companyInfo")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label={t("auth.companyName")}
                required
                error={fieldErrors.companyName}
                className="sm:col-span-2"
              >
                <Input
                  value={companyName}
                  onChange={(e) =>
                    touch("companyName", e.target.value, setCompanyName)
                  }
                  aria-invalid={!!fieldErrors.companyName}
                />
              </FormField>
              <FormField
                label={t("profile.taxNumber")}
                required
                error={fieldErrors.taxNumber}
              >
                <Input
                  value={taxNumber}
                  onChange={(e) =>
                    touch("taxNumber", e.target.value, setTaxNumber)
                  }
                  aria-invalid={!!fieldErrors.taxNumber}
                />
              </FormField>
              <FormField
                label={t("profile.authorizedPerson")}
                required
                error={fieldErrors.authorizedPerson}
              >
                <Input
                  value={authorizedPerson}
                  onChange={(e) =>
                    touch(
                      "authorizedPerson",
                      e.target.value,
                      setAuthorizedPerson
                    )
                  }
                  aria-invalid={!!fieldErrors.authorizedPerson}
                />
              </FormField>
              <FormField
                label={t("profile.phone")}
                required
                error={fieldErrors.orgPhone}
              >
                <Input
                  value={orgPhone}
                  onChange={(e) =>
                    touch("orgPhone", e.target.value, setOrgPhone)
                  }
                  aria-invalid={!!fieldErrors.orgPhone}
                />
              </FormField>
              <FormField
                label={t("profile.avatar")}
                error={fieldErrors.avatarUrl}
              >
                <Input
                  value={avatarUrl}
                  onChange={(e) =>
                    touch("avatarUrl", e.target.value, setAvatarUrl)
                  }
                  placeholder="https://..."
                  aria-invalid={!!fieldErrors.avatarUrl}
                />
              </FormField>
              <FormField
                label={t("profile.address")}
                required
                error={fieldErrors.address}
                className="sm:col-span-2"
              >
                <Textarea
                  value={address}
                  onChange={(e) =>
                    touch("address", e.target.value, setAddress)
                  }
                  rows={3}
                  aria-invalid={!!fieldErrors.address}
                />
              </FormField>
            </div>
          </section>
        )}

        <FormError message={error} />
        {message && <p className="text-sm text-cyan-400">{message}</p>}

        <div>
          <Button onClick={save} loading={saving}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard routeKey="profile">
      <ProfileContent />
    </AuthGuard>
  );
}
