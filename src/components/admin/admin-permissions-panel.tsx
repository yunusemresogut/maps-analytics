"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Shield, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  CRUD_ACTION_LABELS,
  CRUD_ACTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  builtInMatrixForRole,
  normalizePermissions,
  setMatrixCell,
} from "@/lib/permissions";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AppModuleKey,
  PermissionAction,
  PermissionMatrix,
  UserRole,
} from "@/types";

const EDITABLE_ROLES = ALL_ROLES.filter((r) => r !== "admin");

type Tab = "roles" | "users";

function PermissionMatrixTable({
  draft,
  onToggle,
}: {
  draft: PermissionMatrix;
  onToggle: (
    module: AppModuleKey,
    action: PermissionAction,
    value: boolean
  ) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-zinc-950/60 text-left text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Bölüm</th>
            {CRUD_ACTIONS.map((action) => (
              <th key={action} className="px-3 py-3 text-center font-medium">
                {CRUD_ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULE_KEYS.map((module) => (
            <tr key={module} className="border-t border-zinc-800/80">
              <td className="px-4 py-3 text-zinc-300">
                {MODULE_LABELS[module]}
              </td>
              {CRUD_ACTIONS.map((action) => (
                <td key={action} className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={draft[module][action]}
                    onChange={(e) => onToggle(module, action, e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
                    aria-label={`${MODULE_LABELS[module]} ${CRUD_ACTION_LABELS[action]}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPermissionsPanel() {
  const searchParams = useSearchParams();
  const {
    users,
    organization,
    updateUserPermissions,
    updateOrganization,
    getRoleDefaultMatrix,
  } = useAuth();

  const [tab, setTab] = useState<Tab>("roles");
  const [selectedRole, setSelectedRole] = useState<UserRole>("manager");
  const [roleDraft, setRoleDraft] = useState<PermissionMatrix>(
    builtInMatrixForRole("manager")
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState<PermissionMatrix>(
    builtInMatrixForRole("manager")
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const regularUsers = users.filter((u) => u.role !== "admin");
  const selectedUser = regularUsers.find((u) => u.id === selectedUserId);
  const hasOrgOverride = Boolean(
    organization?.rolePermissionDefaults?.[selectedRole]
  );

  useEffect(() => {
    const userId = searchParams.get("user");
    if (userId && regularUsers.some((u) => u.id === userId)) {
      setTab("users");
      setSelectedUserId(userId);
    } else if (!selectedUserId && regularUsers.length > 0) {
      setSelectedUserId(regularUsers[0].id);
    }
  }, [searchParams, regularUsers, selectedUserId]);

  useEffect(() => {
    setRoleDraft(getRoleDefaultMatrix(selectedRole));
  }, [selectedRole, getRoleDefaultMatrix, organization?.rolePermissionDefaults]);

  useEffect(() => {
    if (selectedUser) {
      setUserDraft(
        normalizePermissions(selectedUser.role, selectedUser.permissions)
      );
    }
  }, [selectedUser]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  };

  const saveRoleDefaults = async () => {
    if (!organization) {
      flash("Organizasyon bulunamadı");
      return;
    }
    setSaving(true);
    const next = {
      ...(organization.rolePermissionDefaults ?? {}),
      [selectedRole]: roleDraft,
    };
    const ok = await updateOrganization({ rolePermissionDefaults: next });
    setSaving(false);
    flash(ok ? "Rol varsayılanı kaydedildi" : "Kayıt başarısız");
  };

  const resetRoleToBuiltIn = () => {
    setRoleDraft(builtInMatrixForRole(selectedRole));
  };

  const saveUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    await updateUserPermissions(selectedUserId, userDraft);
    setSaving(false);
    flash("Kullanıcı yetkileri kaydedildi");
  };

  const applyRoleToUserDraft = () => {
    if (!selectedUser) return;
    setUserDraft(getRoleDefaultMatrix(selectedUser.role));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-1">
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            tab === "roles"
              ? "bg-violet-500/20 text-violet-200"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Shield className="h-4 w-4" />
          Rol varsayılanları
        </button>
        <button
          type="button"
          onClick={() => setTab("users")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            tab === "users"
              ? "bg-violet-500/20 text-violet-200"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Users className="h-4 w-4" />
          Kullanıcı yetkileri
        </button>
      </div>

      {message && <p className="text-sm text-emerald-400">{message}</p>}

      {tab === "roles" ? (
        <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">Roller</h2>
            <ul className="space-y-1">
              {EDITABLE_ROLES.map((role) => (
                <li key={role}>
                  <button
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      selectedRole === role
                        ? "bg-violet-500/15 text-violet-200"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    )}
                  >
                    {ROLE_LABELS[role]}
                    {organization?.rolePermissionDefaults?.[role] && (
                      <span className="mt-0.5 block text-[10px] text-cyan-500/80">
                        Özel şablon
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium text-zinc-200">
                  {ROLE_LABELS[selectedRole]}
                </h2>
                <p className="mt-1 max-w-xl text-xs text-zinc-600">
                  Bu matris, bu role sahip yeni kullanıcılar ve “rol varsayılanını
                  uygula” için kullanılır.{" "}
                  {hasOrgOverride
                    ? "Organizasyona özel şablon aktif."
                    : "Şu an uygulama varsayılanı gösteriliyor; kaydedince organizasyona yazılır."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={resetRoleToBuiltIn}>
                  Uygulama varsayılanına dön
                </Button>
                <Button size="sm" onClick={saveRoleDefaults} loading={saving}>
                  Rolü kaydet
                </Button>
              </div>
            </div>

            <PermissionMatrixTable
              draft={roleDraft}
              onToggle={(module, action, value) =>
                setRoleDraft((prev) =>
                  setMatrixCell(prev, module, action, value)
                )
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">
              Kullanıcılar
            </h2>
            <ul className="space-y-1">
              {regularUsers.length === 0 && (
                <li className="text-sm text-zinc-600">
                  Kullanıcı yok.{" "}
                  <Link
                    href="/admin/users"
                    className="text-cyan-400 hover:underline"
                  >
                    Ekle
                  </Link>
                </li>
              )}
              {regularUsers.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                      selectedUserId === u.id
                        ? "bg-violet-500/15 text-violet-200"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    )}
                  >
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-zinc-600">
                      {ROLE_LABELS[u.role]} · {u.email}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            {!selectedUser ? (
              <p className="text-sm text-zinc-600">
                Yetki düzenlemek için kullanıcı seçin
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-violet-400" />
                      <h2 className="font-medium text-zinc-200">
                        {selectedUser.name}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {ROLE_LABELS[selectedUser.role]} · {selectedUser.email}
                    </p>
                    <p className="mt-2 max-w-xl text-xs text-zinc-600">
                      Kullanıcı matrisi kaydedilince rol şablonunu ezer. Rol
                      varsayılanı sekmesindeki şablondan hızlıca doldurabilirsiniz.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={applyRoleToUserDraft}
                    >
                      Rol varsayılanını uygula
                    </Button>
                    <Button size="sm" onClick={saveUser} loading={saving}>
                      Kaydet
                    </Button>
                  </div>
                </div>

                <div className="mt-6">
                  <PermissionMatrixTable
                    draft={userDraft}
                    onToggle={(module, action, value) =>
                      setUserDraft((prev) =>
                        setMatrixCell(prev, module, action, value)
                      )
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
