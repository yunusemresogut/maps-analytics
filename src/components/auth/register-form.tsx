"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { homePathForRole } from "@/lib/roles";
import {
  clearFieldError,
  hasErrors,
  validateRegister,
  type FieldErrors,
} from "@/lib/validation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PageLoader } from "@/components/ui/spinner";

export function RegisterForm() {
  const { isLoading, register, user } = useAuth();
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(homePathForRole(user.role));
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return <PageLoader label={t("common.loading")} />;
  }

  const onField =
    (key: string, setter: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      setFieldErrors((current) => {
        const next = clearFieldError(current, key);
        if (key === "password" || key === "confirmPassword") {
          return clearFieldError(next, "confirmPassword");
        }
        return next;
      });
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const errors = validateRegister({
      email,
      password,
      confirmPassword,
      name,
      companyName,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      const result = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        companyName: companyName.trim(),
      });
      if (!result.ok) setError(result.error || t("auth.registrationError"));
    } catch {
      setError(t("auth.connectionError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.registerTitle")}
      description={t("auth.registerSubtitle")}
    >
      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <FormField
          label={t("auth.fullName")}
          required
          error={fieldErrors.name}
          htmlFor="register-name"
        >
          <Input
            id="register-name"
            value={name}
            onChange={onField("name", setName)}
            autoComplete="name"
            disabled={submitting}
            aria-invalid={!!fieldErrors.name}
          />
        </FormField>

        <FormField
          label={t("auth.companyName")}
          required
          error={fieldErrors.companyName}
          htmlFor="register-company"
        >
          <Input
            id="register-company"
            value={companyName}
            onChange={onField("companyName", setCompanyName)}
            autoComplete="organization"
            disabled={submitting}
            aria-invalid={!!fieldErrors.companyName}
          />
        </FormField>

        <FormField
          label={t("auth.email")}
          required
          error={fieldErrors.email}
          htmlFor="register-email"
        >
          <Input
            id="register-email"
            type="email"
            value={email}
            onChange={onField("email", setEmail)}
            placeholder={t("auth.emailPlaceholder")}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
            aria-invalid={!!fieldErrors.email}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("auth.password")}
            required
            error={fieldErrors.password}
            htmlFor="register-password"
            hint={t("auth.passwordRequirements")}
          >
            <PasswordInput
              id="register-password"
              value={password}
              onChange={onField("password", setPassword)}
              autoComplete="new-password"
              disabled={submitting}
              aria-invalid={!!fieldErrors.password}
              showPasswordLabel={t("auth.showPassword")}
              hidePasswordLabel={t("auth.hidePassword")}
            />
          </FormField>

          <FormField
            label={t("auth.confirmPassword")}
            required
            error={fieldErrors.confirmPassword}
            htmlFor="register-confirm-password"
          >
            <PasswordInput
              id="register-confirm-password"
              value={confirmPassword}
              onChange={onField("confirmPassword", setConfirmPassword)}
              autoComplete="new-password"
              disabled={submitting}
              aria-invalid={!!fieldErrors.confirmPassword}
              showPasswordLabel={t("auth.showPassword")}
              hidePasswordLabel={t("auth.hidePassword")}
            />
          </FormField>
        </div>

        <FormError message={error} />

        <Button type="submit" className="w-full" loading={submitting}>
          {t("auth.register")}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-zinc-500">
        {t("auth.haveAccount")} {" "}
        <Link
          href="/login"
          className="font-medium text-cyan-300 underline-offset-4 hover:underline"
        >
          {t("auth.submit")}
        </Link>
      </p>
    </AuthLayout>
  );
}