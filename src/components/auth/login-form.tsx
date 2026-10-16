"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { homePathForRole } from "@/lib/roles";
import { clearSessionReplaced, wasSessionReplaced } from "@/lib/single-session";
import { clearFieldError, hasErrors, validateLogin, type FieldErrors } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/field-error";
import { PageLoader } from "@/components/ui/spinner";
import { AuthLayout } from "@/components/auth/auth-layout";

export function LoginForm() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [sessionReplaced, setSessionReplaced] = useState(
    () => typeof window !== "undefined" && wasSessionReplaced()
  );

  // Mesaj bir kez gösterilsin; yenilemede tekrar çıkmasın
  useEffect(() => {
    clearSessionReplaced();
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(homePathForRole(user.role));
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return <PageLoader label={t("common.loading")} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSessionReplaced(false);

    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) setError(result.error || t("auth.errorUser"));
    } catch {
      setError(t("auth.connectionError"));
    } finally {
      setSubmitting(false);
    }
  };

  const onField =
    (key: string, setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setFieldErrors((prev) => clearFieldError(prev, key));
    };

  return (
    <AuthLayout title={t("auth.userTitle")} description={t("auth.userSubtitle")}>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <FormField
          label={t("auth.email")}
          required
          error={fieldErrors.email}
          htmlFor="auth-email"
        >
          <Input
            id="auth-email"
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

        <FormField
          label={t("auth.password")}
          required
          error={fieldErrors.password}
          htmlFor="auth-password"
        >
          <PasswordInput
            id="auth-password"
            value={password}
            onChange={onField("password", setPassword)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={submitting}
            aria-invalid={!!fieldErrors.password}
            showPasswordLabel={t("auth.showPassword")}
            hidePasswordLabel={t("auth.hidePassword")}
          />
        </FormField>

        <FormError message={error || (sessionReplaced ? t("auth.sessionReplaced") : "")} />

        <Button type="submit" className="w-full" loading={submitting}>
          {t("auth.submit")}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-zinc-500">
        {t("auth.noAccount")} {" "}
        <Link
          href="/register"
          className="font-medium text-cyan-300 underline-offset-4 hover:underline"
        >
          {t("auth.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
}
