"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const success = login(email, password);
    if (success) {
      router.push("/");
    } else {
      setError("E-posta veya şifre hatalı");
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
          placeholder="ornek@lcw.com"
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
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
        <p className="font-medium text-zinc-400">Demo hesaplar:</p>
        <p className="mt-1">Admin: admin@lcw.com / admin123</p>
        <p>Kullanıcı: ahmet@lcw.com / user123</p>
      </div>
    </form>
  );
}
