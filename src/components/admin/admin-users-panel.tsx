"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Ban,
  Pencil,
  Shield,
  Trash2,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PermissionAction, User } from "@/types";

const PERMISSION_LABELS: Record<PermissionAction, string> = {
  view: "Görüntüleme",
  add: "Ekleme",
  edit: "Düzenleme",
  delete: "Silme",
};

export function AdminUsersPanel() {
  const { users, addUser, updateUser, deleteUser, setUserRestricted } =
    useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

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

  const startEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setMessage("");
  };

  const saveEdit = () => {
    if (!editingUser) return;
    const success = updateUser(editingUser.id, {
      name: editName.trim(),
      email: editEmail.trim(),
      ...(editPassword ? { password: editPassword } : {}),
    });
    if (success) {
      setMessage("Kullanıcı güncellendi");
      setEditingUser(null);
    } else {
      setMessage("Güncelleme başarısız — e-posta kullanımda olabilir");
    }
  };

  const handleDelete = (u: User) => {
    if (!confirm(`"${u.name}" kullanıcısı silinsin mi?`)) return;
    if (deleteUser(u.id)) {
      setMessage("Kullanıcı silindi");
      if (editingUser?.id === u.id) setEditingUser(null);
    }
  };

  const handleRestrict = (u: User) => {
    const next = !u.restricted;
    const label = next ? "kısıtlansın" : "kısıtlaması kaldırılsın";
    if (!confirm(`"${u.name}" ${label} mı?`)) return;
    setUserRestricted(u.id, next);
    setMessage(next ? "Kullanıcı kısıtlandı" : "Kısıtlama kaldırıldı");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
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
          <Button type="submit" className="w-full">
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
              <Input
                type="password"
                placeholder="Yeni şifre (boş bırakılabilir)"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={saveEdit}>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200">
                        {u.name}
                      </p>
                      {u.restricted && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          Kısıtlı
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-zinc-500">{u.email}</p>
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
        </div>
      </div>
    </div>
  );
}
