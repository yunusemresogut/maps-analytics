"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Shield, Trash2, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import {
  CRUD_ACTION_LABELS,
  CRUD_ACTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  builtInMatrixForRole,
  normalizePermissions,
  setMatrixCell,
} from "@/lib/permissions";
import { ALL_ROLES, assignableRoles, getRoleLabel, isBuiltInRole, newCustomRoleKey, roleLabelOverride } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
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
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-zinc-950/60 text-left text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">{t("admin.permissions.section")}</th>
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

type RoleForm = { label: string; description: string; base: UserRole };

/** Yeni özel rol: ad, açıklama ve yetkilerin kopyalanacağı başlangıç rolü */
function NewRoleModal({
  open,
  roles,
  roleLabel,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  roles: UserRole[];
  roleLabel: (role: UserRole) => string;
  saving: boolean;
  onClose: () => void;
  onCreate: (form: RoleForm) => void;
}) {
  const t = useT();
  const formId = useId();
  const [form, setForm] = useState<RoleForm>({ label: "", description: "", base: "store_manager" });
  const [error, setError] = useState("");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("admin.permissions.newRole")}
      description={t("admin.permissions.newRoleDescription")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("admin.permissions.dismiss")}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {t("admin.permissions.createRole")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!form.label.trim()) {
            setError(t("admin.permissions.roleNameRequired"));
            return;
          }
          onCreate({ ...form, label: form.label.trim(), description: form.description.trim() });
        }}
      >
        <FormField label={t("admin.permissions.roleName")} required error={error}>
          <Input
            value={form.label}
            maxLength={40}
            placeholder={t("admin.permissions.roleNamePlaceholder")}
            aria-invalid={!!error}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, label: e.target.value }));
              if (error) setError("");
            }}
          />
        </FormField>
        <FormField label={t("admin.permissions.description")} hint={t("admin.permissions.descriptionHint")}>
          <Input
            value={form.description}
            maxLength={120}
            placeholder={t("admin.permissions.descriptionPlaceholder")}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </FormField>
        <FormField label={t("admin.permissions.basePermissions")}>
          <Select value={form.base} onChange={(e) => setForm((prev) => ({ ...prev, base: e.target.value as UserRole }))}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {t("admin.permissions.likeRole", { role: roleLabel(role) })}
              </option>
            ))}
          </Select>
        </FormField>
      </form>
    </Modal>
  );
}

function RoleListButton({
  label,
  hint,
  count,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        active ? "bg-violet-500/15 text-violet-200" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      )}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{hint}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-zinc-800/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400" title={t("admin.permissions.userCount")}>
        {count}
      </span>
    </button>
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
  const t = useT();

  const [tab, setTab] = useState<Tab>("roles");
  const [selectedRole, setSelectedRole] = useState<UserRole>("manager");
  const [roleDraft, setRoleDraft] = useState<PermissionMatrix>(
    builtInMatrixForRole("manager")
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState<PermissionMatrix>(
    builtInMatrixForRole("manager")
  );
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleLabelDraft, setRoleLabelDraft] = useState("");
  const [roleDescriptionDraft, setRoleDescriptionDraft] = useState("");
  const [applyToUsers, setApplyToUsers] = useState(false);
  const [newRoleOpen, setNewRoleOpen] = useState(false);

  const customRoles = useMemo(() => organization?.customRoles ?? [], [organization?.customRoles]);
  const selectedCustom = customRoles.find((role) => role.key === selectedRole);
  const roleLabel = useCallback((role: UserRole) => getRoleLabel(role, organization), [organization]);
  const regularUsers = users.filter((u) => u.role !== "admin");
  const selectedUser = regularUsers.find((u) => u.id === selectedUserId);
  const usersOfRole = (role: UserRole) => users.filter((u) => u.role === role);
  const selectedRoleUsers = usersOfRole(selectedRole);
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
    const custom = customRoles.find((role) => role.key === selectedRole);
    setRoleLabelDraft(
      // Yerleşik rolde yalnızca özel ad gösterilir; boşsa placeholder varsayılan adı gösterir
      custom ? custom.label : isBuiltInRole(selectedRole) ? roleLabelOverride(selectedRole, organization) ?? "" : ""
    );
    setRoleDescriptionDraft(custom?.description ?? "");
    setApplyToUsers(false);
  }, [selectedRole, getRoleDefaultMatrix, organization, customRoles]);

  useEffect(() => {
    if (selectedUser) {
      setUserDraft(
        normalizePermissions(selectedUser.role, selectedUser.permissions)
      );
    }
  }, [selectedUser]);

  const flash = (text: string, tone: "success" | "error" = "success") => {
    setMessage({ tone, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveRoleDefaults = async () => {
    if (!organization) {
      flash(t("admin.permissions.orgNotFound"), "error");
      return;
    }
    const label = roleLabelDraft.trim();
    if (selectedCustom && !label) {
      flash(t("admin.permissions.roleNameEmpty"), "error");
      return;
    }
    setSaving(true);
    const rolePermissionDefaults = {
      ...(organization.rolePermissionDefaults ?? {}),
      [selectedRole]: roleDraft,
    };
    const ok = selectedCustom
      ? await updateOrganization({
          rolePermissionDefaults,
          customRoles: customRoles.map((role) =>
            role.key === selectedRole
              ? { key: role.key, label, ...(roleDescriptionDraft.trim() ? { description: roleDescriptionDraft.trim() } : {}) }
              : role
          ),
        })
      : await updateOrganization({
          rolePermissionDefaults,
          // Boş ya da varsayılanla aynı ad kaydedilmez; böylece her dilde varsayılan ad görünür
          roleLabels: Object.fromEntries(
            Object.entries({ ...(organization.roleLabels ?? {}), [selectedRole]: label }).filter(
              ([role, value]) => isBuiltInRole(role) && roleLabelOverride(role, { roleLabels: { [role]: value } })
            )
          ),
        });
    // İstenirse bu roldeki kullanıcıların yetkileri de rol şablonuna eşitlenir
    if (ok && applyToUsers) {
      for (const member of selectedRoleUsers) {
        await updateUserPermissions(member.id, roleDraft);
      }
    }
    setSaving(false);
    setApplyToUsers(false);
    if (!ok) flash(t("admin.permissions.saveFailed"), "error");
    else
      flash(
        applyToUsers && selectedRoleUsers.length > 0
          ? t(selectedRoleUsers.length === 1 ? "admin.permissions.roleSavedAppliedOne" : "admin.permissions.roleSavedAppliedOther", {
              count: selectedRoleUsers.length,
            })
          : t("admin.permissions.roleSaved")
      );
  };

  const createRole = async (form: RoleForm) => {
    if (!organization) return;
    setSaving(true);
    const key = newCustomRoleKey();
    const ok = await updateOrganization({
      customRoles: [
        ...customRoles,
        { key, label: form.label, ...(form.description ? { description: form.description } : {}) },
      ],
      rolePermissionDefaults: {
        ...(organization.rolePermissionDefaults ?? {}),
        [key]: getRoleDefaultMatrix(form.base),
      },
    });
    setSaving(false);
    if (!ok) {
      flash(t("admin.permissions.createFailed"), "error");
      return;
    }
    setNewRoleOpen(false);
    setSelectedRole(key);
    flash(t("admin.permissions.roleCreated", { name: form.label }));
  };

  const deleteRole = async () => {
    if (!organization || !selectedCustom) return;
    if (selectedRoleUsers.length > 0) {
      flash(t("admin.permissions.roleHasUsers"), "error");
      return;
    }
    if (!confirm(t("admin.permissions.confirmDeleteRole", { name: selectedCustom.label }))) return;
    setSaving(true);
    // Rol şablonu da birlikte kaldırılır
    const { [selectedCustom.key]: _removed, ...rolePermissionDefaults } = organization.rolePermissionDefaults ?? {};
    void _removed;
    const ok = await updateOrganization({
      customRoles: customRoles.filter((role) => role.key !== selectedCustom.key),
      rolePermissionDefaults,
    });
    setSaving(false);
    if (!ok) {
      flash(t("admin.permissions.deleteFailed"), "error");
      return;
    }
    setSelectedRole("manager");
    flash(t("admin.permissions.roleDeleted"));
  };

  const resetRoleToBuiltIn = () => {
    setRoleDraft(builtInMatrixForRole(selectedRole));
  };

  const saveUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    await updateUserPermissions(selectedUserId, userDraft);
    setSaving(false);
    flash(t("admin.permissions.userSaved"));
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
          {t("admin.permissions.rolesTab")}
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
          {t("admin.permissions.usersTab")}
        </button>
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("text-sm", message.tone === "error" ? "text-red-400" : "text-emerald-400")}>
          {message.text}
        </p>
      )}

      {tab === "roles" ? (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-zinc-300">{t("admin.permissions.customRoles")}</h2>
                <Button size="sm" variant="outline" onClick={() => setNewRoleOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("admin.permissions.newRole")}
                </Button>
              </div>
              {customRoles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
                  {t("admin.permissions.noCustomRoles")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {customRoles.map((role) => (
                    <li key={role.key}>
                      <RoleListButton
                        label={role.label}
                        hint={role.description}
                        count={usersOfRole(role.key).length}
                        active={selectedRole === role.key}
                        onClick={() => setSelectedRole(role.key)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium text-zinc-300">{t("admin.permissions.builtInRoles")}</h2>
              <ul className="space-y-1">
                {EDITABLE_ROLES.map((role) => (
                  <li key={role}>
                    <RoleListButton
                      label={roleLabel(role)}
                      hint={organization?.rolePermissionDefaults?.[role] ? t("admin.permissions.customTemplate") : undefined}
                      count={usersOfRole(role).length}
                      active={selectedRole === role}
                      onClick={() => setSelectedRole(role)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-medium text-zinc-200">
                  {roleLabel(selectedRole)}
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-normal text-zinc-400">
                    {selectedCustom ? t("admin.permissions.customRole") : t("admin.permissions.builtInRole")}
                  </span>
                </h2>
                <p className="mt-1 max-w-xl text-xs text-zinc-500">
                  {t("admin.permissions.matrixHint")}{" "}
                  {selectedCustom
                    ? t("admin.permissions.customRoleHint")
                    : hasOrgOverride
                      ? t("admin.permissions.orgTemplateActive")
                      : t("admin.permissions.builtInShown")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCustom ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteRole()}
                    disabled={saving || selectedRoleUsers.length > 0}
                    title={selectedRoleUsers.length > 0 ? t("admin.permissions.roleHasUsers") : undefined}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("admin.permissions.deleteRole")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={resetRoleToBuiltIn}>
                    {t("admin.permissions.resetToBuiltIn")}
                  </Button>
                )}
                <Button size="sm" onClick={() => void saveRoleDefaults()} loading={saving}>
                  {t("admin.permissions.saveRole")}
                </Button>
              </div>
            </div>

            <div className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-2">
              <FormField label={selectedCustom ? t("admin.permissions.roleName") : t("admin.permissions.displayName")} required={!!selectedCustom}>
                <Input
                  value={roleLabelDraft}
                  maxLength={40}
                  onChange={(e) => setRoleLabelDraft(e.target.value)}
                  placeholder={selectedCustom ? t("admin.permissions.roleNameShortPlaceholder") : getRoleLabel(selectedRole)}
                />
              </FormField>
              {selectedCustom && (
                <FormField label={t("admin.permissions.description")}>
                  <Input
                    value={roleDescriptionDraft}
                    maxLength={120}
                    onChange={(e) => setRoleDescriptionDraft(e.target.value)}
                    placeholder={t("admin.permissions.optional")}
                  />
                </FormField>
              )}
            </div>

            <PermissionMatrixTable
              draft={roleDraft}
              onToggle={(module, action, value) =>
                setRoleDraft((prev) =>
                  setMatrixCell(prev, module, action, value)
                )
              }
            />

            <label className="mt-4 flex items-start gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={applyToUsers}
                disabled={selectedRoleUsers.length === 0}
                onChange={(e) => setApplyToUsers(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
              />
              <span>
                {t(selectedRoleUsers.length === 1 ? "admin.permissions.applyToUsersOne" : "admin.permissions.applyToUsersOther", {
                  count: selectedRoleUsers.length,
                })}
                <span className="block text-xs text-zinc-600">
                  {t("admin.permissions.applyToUsersHint")}
                </span>
              </span>
            </label>
          </div>

          {newRoleOpen && (
            <NewRoleModal
              open
              roles={assignableRoles(organization)}
              roleLabel={roleLabel}
              saving={saving}
              onClose={() => setNewRoleOpen(false)}
              onCreate={(form) => void createRole(form)}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">
              {t("nav.users")}
            </h2>
            <ul className="space-y-1">
              {regularUsers.length === 0 && (
                <li className="text-sm text-zinc-600">
                  {t("admin.permissions.noUsers")}{" "}
                  <Link
                    href="/admin/users"
                    className="text-cyan-400 hover:underline"
                  >
                    {t("common.add")}
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
                      {getRoleLabel(u.role, organization)} · {u.email}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            {!selectedUser ? (
              <p className="text-sm text-zinc-600">
                {t("admin.permissions.selectUser")}
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
                      {getRoleLabel(selectedUser.role, organization)} · {selectedUser.email}
                    </p>
                    <p className="mt-2 max-w-xl text-xs text-zinc-600">
                      {t("admin.permissions.userMatrixHint")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={applyRoleToUserDraft}
                    >
                      {t("admin.permissions.applyRoleDefault")}
                    </Button>
                    <Button size="sm" onClick={saveUser} loading={saving}>
                      {t("common.save")}
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
