"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPage() {
  const { user, isLoading, users, addUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

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

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    );
  }

  const regularUsers = users.filter((u) => u.role === "user");

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Admin Paneli</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Harita erişimi olan kullanıcıları yönetin
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                  message.includes("başarı") ? "text-emerald-400" : "text-red-400"
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
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="font-medium text-zinc-200">
              Kullanıcılar ({regularUsers.length})
            </h2>
          </div>
          <ul className="space-y-2">
            {regularUsers.length === 0 && (
              <li className="text-sm text-zinc-600">Henüz kullanıcı yok</li>
            )}
            {regularUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400">
                  Aktif
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
