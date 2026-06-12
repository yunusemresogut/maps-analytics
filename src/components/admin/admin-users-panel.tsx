"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { DEFAULT_USER_PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PermissionAction, User, UserPermissions } from "@/types";

const PERMISSION_LABELS: Record<PermissionAction, string> = {
  view: "Görüntüleme",
  add: "Ekleme",
  edit: "Düzenleme",
  delete: "Silme",
};

export function AdminUsersPanel() {
  const { users, addUser, updateUserPermissions } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<UserPermissions>(
    DEFAULT_USER_PERMISSIONS
  );

  const regularUsers = users.filter((u) => u.role === "user");

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const success = addUser({ name, email, password });
    if (success) {
      setMessage("Kullanıcı başarıyla eklendi");
      setName("");
      setEmail("");
      setPassword("");
    } else {
      setMessage("Bu e-posta zaten kayıtlı");
    }
  };

  const startEditPermissions = (user: User) => {
    setEditingId(user.id);
    setEditPerms({ ...user.permissions });
  };

  const savePermissions = () => {
    if (!editingId) return;
    updateUserPermissions(editingId, editPerms);
    setEditingId(null);
    setMessage("Yetkiler güncellendi");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-cyan-400" />
          <h2 className="font-medium text-zinc-200">Yeni Kullanıcı</h2>
        </div>
        <form onSubmit={handleAddUser} className="space-y-3">
          <Input
            placeholder="Ad Soyad"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {message && (
            <p
              className={`text-sm ${
                message.includes("başarı") || message.includes("güncellendi")
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
          <Button type="submit" className="w-full">
            Kullanıcı Ekle
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 font-medium text-zinc-200">
          Kullanıcılar ({regularUsers.length})
        </h2>
        <ul className="space-y-3">
          {regularUsers.length === 0 && (
            <li className="text-sm text-zinc-600">Henüz kullanıcı yok</li>
          )}
          {regularUsers.map((u) => (
            <li
              key={u.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEditPermissions(u)}
                >
                  Yetkiler
                </Button>
              </div>

              {editingId === u.id ? (
                <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                  {(Object.keys(PERMISSION_LABELS) as PermissionAction[]).map(
                    (action) => (
                      <label
                        key={action}
                        className="flex items-center gap-2 text-sm text-zinc-400"
                      >
                        <input
                          type="checkbox"
                          checked={editPerms[action]}
                          onChange={(e) =>
                            setEditPerms((prev) => ({
                              ...prev,
                              [action]: e.target.checked,
                            }))
                          }
                          className="rounded border-zinc-600 bg-zinc-900"
                        />
                        {PERMISSION_LABELS[action]}
                      </label>
                    )
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={savePermissions}>
                      Kaydet
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      İptal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.keys(PERMISSION_LABELS) as PermissionAction[])
                    .filter((a) => u.permissions[a])
                    .map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400"
                      >
                        {PERMISSION_LABELS[a]}
                      </span>
                    ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
