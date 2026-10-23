import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

// Giriş gerektiren sayfalar arama motorlarında listelenmesin
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Giriş sonrası panel: üst bar, kenar menü ve asistan */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
