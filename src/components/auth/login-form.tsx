"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginFormProps = {
  mode: "user" | "admin";
};

export function LoginForm({ mode }: LoginFormProps) {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !user) return;
    if (mode === "admin" && user.role === "admin") {
      router.replace("/admin/dashboard");
    } else if (mode === "user" && user.role === "user") {
      router.replace("/map");
    }
  }, [user, isLoading, mode, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const expectedRole = mode === "admin" ? "admin" : "user";
    const success = login(email, password, expectedRole);

    if (!success) {
      setError(
        mode === "admin"
          ? "Admin girişi başarısız. Sadece admin hesapları girebilir."
          : "E-posta veya şifre hatalı, ya da hesabınız kısıtlanmış olabilir"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm text-zinc-400">E-posta</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@sirket.com"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-zinc-400">Şifre</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full">
        Giriş Yap
      </Button>

      {mode === "user" ? (
        <p className="text-center text-xs text-zinc-500">
          Admin misiniz?{" "}
          <Link href="/admin/login" className="text-cyan-400 hover:underline">
            Admin girişi
          </Link>
        </p>
      ) : (
        <p className="text-center text-xs text-zinc-500">
          Kullanıcı mısınız?{" "}
          <Link href="/login" className="text-cyan-400 hover:underline">
            Kullanıcı girişi
          </Link>
        </p>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
        <p className="font-medium text-zinc-400">Demo hesaplar:</p>
        {mode === "admin" ? (
          <p className="mt-1">Admin: admin@demo.com / admin123</p>
        ) : (
          <>
            <p className="mt-1">Kullanıcı: ahmet@demo.com / user123</p>
            <p>Sadece görüntüleme+düzenleme: ayse@demo.com / user123</p>
          </>
        )}
      </div>
    </form>
  );
}
