"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Map } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { homePathForRole } from "@/lib/roles";
import {
  clearFieldError,
  hasErrors,
  validateLogin,
  validateRegister,
  type FieldErrors,
} from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/field-error";
import { PageLoader } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export function LoginForm() {
  const { login, register, user, isLoading } = useAuth();
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const errors =
      mode === "login"
        ? validateLogin({ email, password })
        : validateRegister({ email, password, name, companyName });

    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        const result = await login(email, password);
        if (!result.ok) setError(result.error || t("auth.errorUser"));
      } else {
        const result = await register({
          email,
          password,
          name,
          companyName,
        });
        if (!result.ok) setError(result.error || t("auth.errorUser"));
      }
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
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
          <Map className="h-5 w-5 text-cyan-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-100">
          {mode === "login" ? t("auth.userTitle") : t("auth.registerTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {mode === "login"
            ? t("auth.userSubtitle")
            : t("auth.registerSubtitle")}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setFieldErrors({});
            }}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              mode === "login"
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t("auth.submit")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
              setFieldErrors({});
            }}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              mode === "register"
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t("auth.register")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === "register" && (
            <>
              <FormField
                label={t("auth.fullName")}
                required
                error={fieldErrors.name}
                htmlFor="reg-name"
              >
                <Input
                  id="reg-name"
                  value={name}
                  onChange={onField("name", setName)}
                  aria-invalid={!!fieldErrors.name}
                />
              </FormField>
              <FormField
                label={t("auth.companyName")}
                required
                error={fieldErrors.companyName}
                htmlFor="reg-company"
              >
                <Input
                  id="reg-company"
                  value={companyName}
                  onChange={onField("companyName", setCompanyName)}
                  aria-invalid={!!fieldErrors.companyName}
                />
              </FormField>
            </>
          )}

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
              aria-invalid={!!fieldErrors.email}
            />
          </FormField>

          <FormField
            label={t("auth.password")}
            required
            error={fieldErrors.password}
            htmlFor="auth-password"
            hint={mode === "register" ? "En az 6 karakter" : undefined}
          >
            <PasswordInput
              id="auth-password"
              value={password}
              onChange={onField("password", setPassword)}
              placeholder="••••••••"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              aria-invalid={!!fieldErrors.password}
            />
          </FormField>

          <FormError message={error} />

          <Button type="submit" className="w-full" loading={submitting}>
            {mode === "login" ? t("auth.submit") : t("auth.register")}
          </Button>
        </form>
      </div>
    </div>
  );
}
