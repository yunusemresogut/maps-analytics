import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AssistantWidget } from "@/components/assistant/assistant-widget";

/** Panel iskeleti; yalnızca (panel) route group'unun layout'unda kullanılır */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {children}
          <AssistantWidget />
        </main>
      </div>
    </>
  );
}
