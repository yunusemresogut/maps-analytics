"use client";

import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </>
  );
}
