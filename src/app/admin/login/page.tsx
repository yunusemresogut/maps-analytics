import Link from "next/link";
import { Shield } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/admin/login" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 shadow-[0_0_20px_rgba(167,139,250,0.2)]">
              <Shield className="h-5 w-5 text-violet-400" />
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-100">
            Admin Girişi
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Yönetim paneline erişmek için giriş yapın
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
          <LoginForm mode="admin" />
        </div>
      </div>
    </div>
  );
}
