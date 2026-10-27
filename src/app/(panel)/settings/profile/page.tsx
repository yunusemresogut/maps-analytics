"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useT } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/field-error";
import { UserAvatar } from "@/components/ui/user-avatar";
import { removeAvatarFiles, uploadAvatar } from "@/lib/avatar-upload";
import {
  clearFieldError,
  hasErrors,
  validateProfile,
  type FieldErrors,
} from "@/lib/validation";

function ProfileContent() {
  const { user, updateProfile } = useAuth();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(user?.name ?? "");
      setPhone(user?.phone ?? "");
      setAvatarUrl(user?.avatarUrl ?? "");
      setAvatarPreview(user?.avatarUrl ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [user]);

  const touch = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    setFieldErrors((prev) => clearFieldError(prev, key));
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setAvatarError("");
    setAvatarUploading(true);
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    const result = await uploadAvatar(user.id, file);
    setAvatarUploading(false);
    if (!result.ok) {
      setAvatarError(result.error);
      setAvatarPreview(avatarUrl);
      URL.revokeObjectURL(localPreview);
      return;
    }
    const saved = await updateProfile({ avatarUrl: result.url });
    if (!saved) {
      setAvatarError(t("settings.profile.avatarProfileFailed"));
      setAvatarPreview(avatarUrl);
      URL.revokeObjectURL(localPreview);
      return;
    }
    setAvatarUrl(result.url);
    setAvatarPreview(result.url);
    URL.revokeObjectURL(localPreview);
  };

  const resetAvatar = async () => {
    setAvatarError("");
    if (!user) return;
    const saved = await updateProfile({ avatarUrl: null });
    if (!saved) {
      setAvatarError(t("settings.profile.avatarRemoveFailed"));
      return;
    }
    setAvatarUrl("");
    setAvatarPreview("");
    await removeAvatarFiles(user.id);
  };

  const save = async () => {
    setMessage("");
    setError("");
    const errors = validateProfile({ name, phone, avatarUrl });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSaving(true);
    const okUser = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      avatarUrl: avatarUrl.trim() || undefined,
    });
    setSaving(false);
    if (okUser) setMessage(t("profile.saved"));
    else setError(t("settings.profile.saveFailed"));
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">
          {t("profile.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("profile.description")}</p>
      </div>

      <div className="grid w-full gap-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">
            {t("profile.userInfo")}
          </h2>
          <div className="mb-4 flex items-center gap-4">
            <div className="relative">
              <UserAvatar
                name={name || user?.name || "?"}
                avatarUrl={avatarPreview}
                size="lg"
              />
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-zinc-200">
                  …
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                {t("settings.profile.choosePhoto")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetAvatar}
                disabled={avatarUploading || !avatarUrl}
              >
                {t("settings.profile.resetAvatar")}
              </Button>
            </div>
          </div>
          {avatarError && (
            <p className="mb-3 text-xs text-red-400">{avatarError}</p>
          )}
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
