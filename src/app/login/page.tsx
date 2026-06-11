import Link from "next/link";
import { Map } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <Map className="h-5 w-5 text-cyan-400" />
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-100">
            Giriş Yap
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Mağaza notları ve dosyalarına erişmek için giriş yapın
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
