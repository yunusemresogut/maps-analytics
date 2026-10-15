"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AssistantWidget } from "@/components/assistant/assistant-widget";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <AssistantWidget />
    </>
  );
}
