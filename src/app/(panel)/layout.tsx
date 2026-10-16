import { AppShell } from "@/components/layout/app-shell";

/** Giriş sonrası panel: üst bar, kenar menü ve asistan */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
