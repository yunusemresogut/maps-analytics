"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { homePath, prefsLoaded } = useSettings();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (prefsLoaded) {
      router.replace(homePath);
    }
  }, [user, isLoading, prefsLoaded, homePath, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
    </div>
  );
}
