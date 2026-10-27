"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Ban,
  Pencil,
  Shield,
  Trash2,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { TablePagination } from "@/components/modules/module-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { assignableRoles, getRoleLabel } from "@/lib/roles";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/permissions";
import {
  clearFieldError,
  hasErrors,
  validateUserCreate,
  type FieldErrors,
} from "@/lib/validation";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import type { User, UserRole } from "@/types";

type UserSortKey = "name" | "email" | "role";

export function AdminUsersPanel() {
  const {
    users,
    organization,
    addUser,
    updateUser,
    deleteUser,
    setUserRestricted,
    getRoleDefaultMatrix,
  } = useAuth();
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("manager");
  const [message, setMessageText] = useState("");
  // Mesajın rengi: başarılı işlem yeşil, hata kırmızı
  const [messageOk, setMessageOk] = useState(false);
  const setMessage = (text: string, ok = false) => {
    setMessageText(text);
    setMessageOk(ok);
  };
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("manager");
  const [applyRoleDefaults, setApplyRoleDefaults] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  // Yerleşik roller ve firmanın özel rolleri
  const creatableRoles = assignableRoles(organization);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const orgUsers = useMemo(
    () => users.filter((u) => u.role !== "admin"),
    [users]
  );

  const getSortValue = useCallback((user: User, key: UserSortKey) => {
    if (key === "role") return getRoleLabel(user.role, organization);
    return user[key];
  }, [organization]);

  const table = useTableState<User, UserSortKey>({
    memoryKey: "admin-users",
    items: orgUsers,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
    resetKey: String(orgUsers.length),
  });

  const onSortKeyChange = (key: UserSortKey) => {
    if (table.sort.key !== key) {
      table.setSortKey(key);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const errors = validateUserCreate({ name, email, password });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    const result = await addUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      permissions: getRoleDefaultMatrix(role),
    });
    setSubmitting(false);
    if (result.ok) {
      setMessage(t("admin.users.added"), true);
      setName("");
      setEmail("");
      setPassword("");
      setRole("manager");
      setFieldErrors({});
    } else {
      setMessage(result.error || t("admin.users.createFailed"));
    }
  };

  const startEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditRole(u.role);
    setApplyRoleDefaults(true);
    setMessage("");
  };

  const [savingEdit, setSavingEdit] = useState(false);

  const saveEdit = async () => {
    if (!editingUser) return;
    if (!editName.trim() || editName.trim().length < 2) {
      setMessage(t("admin.users.nameTooShort"));
      return;
    }
    if (!editEmail.includes("@")) {
      setMessage(t("admin.users.invalidEmail"));
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setMessage(t("admin.users.passwordTooShort"));
      return;
    }
    setSavingEdit(true);
    const success = await updateUser(editingUser.id, {
      name: editName.trim(),
      email: editEmail.trim(),
      role: editRole,
      applyRoleDefaultPermissions: applyRoleDefaults,
      ...(editPassword ? { password: editPassword } : {}),
    });
    setSavingEdit(false);
    if (success) {
      setMessage(t("admin.users.updated"), true);
      setEditingUser(null);
    } else {
      setMessage(t("admin.users.updateFailed"));
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(t("admin.users.confirmDelete", { name: u.name }))) return;
    const success = await deleteUser(u.id);
    if (success) {
      setMessage(t("admin.users.deleted"), true);
      if (editingUser?.id === u.id) setEditingUser(null);
    }
  };

  const handleRestrict = async (u: User) => {
    const next = !u.restricted;
    if (!confirm(t(next ? "admin.users.confirmRestrict" : "admin.users.confirmUnrestrict", { name: u.name }))) return;
    await setUserRestricted(u.id, next);
    setMessage(next ? t("admin.users.restricted") : t("admin.users.unrestricted"), true);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-cyan-400" />
          <h2 className="font-medium text-zinc-200">{t("admin.users.newUser")}</h2>
        </div>
        <form onSubmit={handleAddUser} className="space-y-3" noValidate>
          <FormField label={t("auth.fullName")} required error={fieldErrors.name}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => clearFieldError(prev, "name"));
              }}
              aria-invalid={!!fieldErrors.name}
            />
          </FormField>
          <FormField label={t("auth.email")} required error={fieldErrors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => clearFieldError(prev, "email"));
              }}
              aria-invalid={!!fieldErrors.email}
            />
          </FormField>
          <FormField
            label={t("auth.password")}
            required
            error={fieldErrors.password}
            hint={t("auth.passwordRequirements")}
          >
            <PasswordInput
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => clearFieldError(prev, "password"));
              }}
              aria-invalid={!!fieldErrors.password}
            />
          </FormField>
          <FormField label={t("admin.users.role")} required>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>
                  {getRoleLabel(r, organization)}
                </option>
              ))}
            </Select>
          </FormField>
          {message && !editingUser && (
            <p
              className={`text-sm ${
                messageOk
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" loading={submitting}>
            {t("admin.users.addUser")}
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {editingUser && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
            <h3 className="mb-3 text-sm font-medium text-cyan-300">
              {t("admin.users.editUser")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder={t("auth.fullName")}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Input
                type="email"
                placeholder={t("auth.email")}
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              <Select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="sm:col-span-2"
              >
                {creatableRoles.map((r) => (
                  <option key={r} value={r}>
                    {getRoleLabel(r, organization)}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-xs text-zinc-400 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={applyRoleDefaults}
                  onChange={(e) => setApplyRoleDefaults(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
                />
                {t("admin.users.applyRoleDefaults")}
              </label>
              <div className="sm:col-span-2">
                <PasswordInput
                  placeholder={t("admin.users.newPasswordPlaceholder")}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={saveEdit} loading={savingEdit}>
                {t("common.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingUser(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium text-zinc-200">
              {t("admin.users.listTitle", { count: orgUsers.length })}
            </h2>
            <Select
              value={table.sort.key}
              onChange={(e) => onSortKeyChange(e.target.value as UserSortKey)}
              className="h-9 w-auto min-w-[140px]"
            >
              <option value="name">{t("admin.regions.sortByName")}</option>
              <option value="email">{t("admin.users.sortByEmail")}</option>
              <option value="role">{t("admin.users.sortByRole")}</option>
            </Select>
          </div>
          <ul className="space-y-3">
            {table.totalItems === 0 && (
              <li className="text-sm text-zinc-600">{t("admin.users.empty")}</li>
            )}
            {table.pageItems.map((u) => (
              <li
                key={u.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200">
                        {u.name}
                      </p>
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                        {getRoleLabel(u.role, organization)}
                      </span>
                      {u.restricted && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          {t("admin.users.restrictedBadge")}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-zinc-500">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {MODULE_KEYS.filter((k) => u.permissions[k]?.view).map(
                        (k) => (
                          <span
                            key={k}
                            className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400"
                          >
                            {MODULE_LABELS[k]}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(u)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t("common.edit")}
                    </Button>
                    <Link href={`/admin/permissions?user=${u.id}`}>
                      <Button size="sm" variant="outline">
                        <Shield className="h-3.5 w-3.5" />
                        {t("nav.permissions")}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestrict(u)}
                    >
                      {u.restricted ? (
                        <>
                          <UserCheck className="h-3.5 w-3.5" />
                          {t("admin.users.unrestrict")}
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5" />
                          {t("admin.users.restrict")}
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            <TablePagination
              page={table.page}
              totalPages={table.totalPages}
              totalItems={table.totalItems}
              rangeStart={table.rangeStart}
              rangeEnd={table.rangeEnd}
              onPageChange={table.setPage}
              pageSize={table.pageSize}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
