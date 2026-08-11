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
import { TablePagination } from "@/components/modules/module-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/roles";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/permissions";
import {
  clearFieldError,
  hasErrors,
  validateRegister,
  type FieldErrors,
} from "@/lib/validation";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import type { User, UserRole } from "@/types";

type UserSortKey = "name" | "email" | "role";

const CREATABLE_ROLES = ALL_ROLES.filter((r) => r !== "admin");

export function AdminUsersPanel() {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    setUserRestricted,
    getRoleDefaultMatrix,
  } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("manager");
  const [message, setMessage] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("manager");
  const [applyRoleDefaults, setApplyRoleDefaults] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const orgUsers = useMemo(
    () => users.filter((u) => u.role !== "admin"),
    [users]
  );

  const getSortValue = useCallback((user: User, key: UserSortKey) => {
    if (key === "role") return ROLE_LABELS[user.role] ?? user.role;
    return user[key];
  }, []);

  const table = useTableState<User, UserSortKey>({
    items: orgUsers,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
    resetKey: String(orgUsers.length),
  });

  const onSortKeyChange = (key: UserSortKey) => {
    if (table.sort.key !== key) {
      table.toggleSort(key);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const errors = validateRegister({
      name,
      email,
      password,
      companyName: "x", // not used for users; keep register shape for name/email/password
    });
    // company not needed for user create
    delete errors.companyName;
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    const success = await addUser({
      name,
      email,
      password,
      role,
      permissions: getRoleDefaultMatrix(role),
    });
    setSubmitting(false);
    if (success) {
      setMessage("Kullanıcı başarıyla eklendi");
      setName("");
      setEmail("");
      setPassword("");
      setRole("manager");
      setFieldErrors({});
    } else {
      setMessage("Bu e-posta zaten kayıtlı veya eklenemedi");
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
      setMessage("Ad soyad en az 2 karakter olmalı");
      return;
    }
    if (!editEmail.includes("@")) {
      setMessage("Geçerli bir e-posta girin");
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setMessage("Yeni şifre en az 6 karakter olmalı");
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
      setMessage("Kullanıcı güncellendi");
      setEditingUser(null);
    } else {
      setMessage("Güncelleme başarısız — e-posta kullanımda olabilir");
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`"${u.name}" kullanıcısı silinsin mi?`)) return;
    const success = await deleteUser(u.id);
    if (success) {
      setMessage("Kullanıcı silindi");
      if (editingUser?.id === u.id) setEditingUser(null);
    }
  };

  const handleRestrict = async (u: User) => {
    const next = !u.restricted;
    const label = next ? "kısıtlansın" : "kısıtlaması kaldırılsın";
    if (!confirm(`"${u.name}" ${label} mı?`)) return;
    await setUserRestricted(u.id, next);
    setMessage(next ? "Kullanıcı kısıtlandı" : "Kısıtlama kaldırıldı");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-cyan-400" />
          <h2 className="font-medium text-zinc-200">Yeni Kullanıcı</h2>
        </div>
        <form onSubmit={handleAddUser} className="space-y-3" noValidate>
          <FormField label="Ad Soyad" required error={fieldErrors.name}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => clearFieldError(prev, "name"));
              }}
              aria-invalid={!!fieldErrors.name}
            />
          </FormField>
          <FormField label="E-posta" required error={fieldErrors.email}>
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
            label="Şifre"
            required
            error={fieldErrors.password}
            hint="En az 6 karakter"
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
          <FormField label="Rol" required>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {CREATABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </FormField>
          {message && !editingUser && (
            <p
              className={`text-sm ${
                message.includes("başarı") ||
                message.includes("güncellendi") ||
                message.includes("silindi") ||
                message.includes("kısıt") ||
                message.includes("kaldırıldı")
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" loading={submitting}>
            Kullanıcı Ekle
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {editingUser && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
            <h3 className="mb-3 text-sm font-medium text-cyan-300">
              Kullanıcı Düzenle
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Ad Soyad"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="E-posta"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              <Select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="sm:col-span-2"
              >
                {CREATABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
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
                Rol değişince varsayılan yetki matrisini uygula
              </label>
              <div className="sm:col-span-2">
                <PasswordInput
                  placeholder="Yeni şifre (boş bırakılabilir)"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={saveEdit} loading={savingEdit}>
                Kaydet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingUser(null)}
              >
                İptal
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium text-zinc-200">
              Kullanıcılar ({orgUsers.length})
            </h2>
            <Select
              value={table.sort.key}
              onChange={(e) => onSortKeyChange(e.target.value as UserSortKey)}
              className="h-9 w-auto min-w-[140px]"
            >
              <option value="name">Ada göre</option>
              <option value="email">E-postaya göre</option>
              <option value="role">Role göre</option>
            </Select>
          </div>
          <ul className="space-y-3">
            {table.totalItems === 0 && (
              <li className="text-sm text-zinc-600">Henüz kullanıcı yok</li>
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
                        {ROLE_LABELS[u.role]}
                      </span>
                      {u.restricted && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          Kısıtlı
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
                      Düzenle
                    </Button>
                    <Link href={`/admin/permissions?user=${u.id}`}>
                      <Button size="sm" variant="outline">
                        <Shield className="h-3.5 w-3.5" />
                        Yetkiler
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
                          Aç
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5" />
                          Kısıtla
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
