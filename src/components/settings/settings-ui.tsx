"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Anında kaydedilen ayarlar için durum: kaydediliyor → kaydedildi / hata */
export function useAutoSave() {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const run = useCallback(async (save: () => Promise<boolean>) => {
    if (timer.current) window.clearTimeout(timer.current);
    setState("saving");
    const ok = await save();
    setState(ok ? "saved" : "error");
    if (ok) timer.current = window.setTimeout(() => setState("idle"), 2000);
    return ok;
  }, []);

  return { state, run };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        state === "error" ? "text-red-400" : state === "saved" ? "text-emerald-400" : "text-zinc-500"
      )}
    >
      {state === "saving" && <Spinner size="sm" />}
      {state === "saved" && <Check className="h-3.5 w-3.5" />}
      {state === "error" && <CircleAlert className="h-3.5 w-3.5" />}
      {state === "saving" ? "Kaydediliyor…" : state === "saved" ? "Kaydedildi" : "Kaydedilemedi"}
    </span>
  );
}

export function SettingsPageHeader({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status?: SaveState;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {status && <SaveIndicator state={status} />}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="divide-y divide-zinc-800/70">{children}</div>
    </section>
  );
}

/** Etiket + açıklama solda, kontrol sağda */
export function SettingRow({
  label,
  description,
  children,
  indent,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
  indent?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5", indent && "pl-10")}>
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-sm text-zinc-200">{label}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  lockedReason,
  indent,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Kullanıcı değiştiremiyorsa nedeni (ör. firma tarafından zorunlu) */
  lockedReason?: string;
  indent?: boolean;
}) {
  return (
    <SettingRow label={label} description={description} indent={indent}>
      {lockedReason && (
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
          <Lock className="h-3 w-3" />
          {lockedReason}
        </span>
      )}
      <Switch checked={checked} onChange={onChange} disabled={disabled || Boolean(lockedReason)} ariaLabel={label} />
    </SettingRow>
  );
}
