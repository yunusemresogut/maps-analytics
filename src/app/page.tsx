"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { homePathForRole } from "@/lib/roles";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace(homePathForRole(user.role));
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
    </div>
  );
}
