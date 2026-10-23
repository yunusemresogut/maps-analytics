"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/contexts/i18n-context";
import { formatDocumentTitle, resolvePageTitleKey } from "@/lib/page-titles";

const PageTitleContext = createContext<((detail: string | null) => void) | null>(null);

/**
 * Sekme başlığını rota ve seçili dile göre günceller. Sayfalar client component olduğundan
 * metadata yalnızca varsayılan dili (TR) verir; dil değişince ve kayıt adları yüklenince
 * başlığı burada tamamlıyoruz.
 */
export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const key = resolvePageTitleKey(pathname);
    // Eşlenmeyen rotalarda (ör. 404) server metadata'sı geçerli kalsın
    if (!key) return;

    const title = formatDocumentTitle([detail, t(key)].filter(Boolean).join(" · "));
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();

    // Next, gezinme sonrası metadata'dan <title>'ı yeniden yazabilir; başlığımızı koru
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname, detail, t]);

  return <PageTitleContext.Provider value={setDetail}>{children}</PageTitleContext.Provider>;
}

/** Detay sayfalarında kayıt adını başlığa ekler: "Kadıköy · Mağazalar | Koordine" */
export function usePageTitle(detail: string | null | undefined) {
  const setDetail = useContext(PageTitleContext);

  useEffect(() => {
    if (!setDetail) return;
    setDetail(detail?.trim() || null);
    return () => setDetail(null);
  }, [setDetail, detail]);
}
