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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const expectedRole = mode === "admin" ? "admin" : "user";
    const success = await login(email, password, expectedRole);

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
    </form>
  );
}
