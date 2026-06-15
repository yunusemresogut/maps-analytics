"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  DEFAULT_USER_PERMISSIONS,
  PERMISSION_PRESETS,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import type { PermissionAction, UserPermissions } from "@/types";

const PERMISSION_LABELS: Record<PermissionAction, string> = {
  view: "Görüntüleme",
  add: "Ekleme",
  edit: "Düzenleme",
  delete: "Silme",
};

const ACTIONS = Object.keys(PERMISSION_LABELS) as PermissionAction[];

export function AdminPermissionsPanel() {
  const searchParams = useSearchParams();
  const { users, updateUserPermissions } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserPermissions>(DEFAULT_USER_PERMISSIONS);
  const [message, setMessage] = useState("");

  const regularUsers = users.filter((u) => u.role === "user");
  const selected = regularUsers.find((u) => u.id === selectedId);

  useEffect(() => {
    const userId = searchParams.get("user");
    if (userId && regularUsers.some((u) => u.id === userId)) {
      setSelectedId(userId);
    } else if (!selectedId && regularUsers.length > 0) {
      setSelectedId(regularUsers[0].id);
    }
  }, [searchParams, regularUsers, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft({ ...selected.permissions });
    }
  }, [selected]);

  const save = () => {
    if (!selectedId) return;
    updateUserPermissions(selectedId, draft);
    setMessage("Yetkiler kaydedildi");
    setTimeout(() => setMessage(""), 2000);
  };

  const applyPreset = (permissions: UserPermissions) => {
    setDraft({ ...permissions });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Kullanıcılar</h2>
        <ul className="space-y-1">
          {regularUsers.length === 0 && (
            <li className="text-sm text-zinc-600">
              Kullanıcı yok.{" "}
              <Link href="/admin/users" className="text-cyan-400 hover:underline">
                Ekle
              </Link>
            </li>
          )}
          {regularUsers.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelectedId(u.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selectedId === u.id
                    ? "bg-violet-500/15 text-violet-200"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-zinc-600">{u.email}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        {!selected ? (
          <p className="text-sm text-zinc-600">Yetki düzenlemek için kullanıcı seçin</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-violet-400" />
                  <h2 className="font-medium text-zinc-200">{selected.name}</h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{selected.email}</p>
              </div>
              <Button size="sm" onClick={save}>
                Kaydet
              </Button>
            </div>

            {message && (
              <p className="mt-3 text-sm text-emerald-400">{message}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {Object.values(PERMISSION_PRESETS).map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset(preset.permissions)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[320px] text-sm">
                <thead className="bg-zinc-950/60 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Yetki</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIONS.map((action) => (
                    <tr key={action} className="border-t border-zinc-800/80">
                      <td className="px-4 py-3 text-zinc-300">
                        {PERMISSION_LABELS[action]}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft[action]}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [action]: e.target.checked,
                              }))
                            }
                            className="rounded border-zinc-600 bg-zinc-900"
                          />
                          <span className="text-xs text-zinc-500">
                            {draft[action] ? "Aktif" : "Kapalı"}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
