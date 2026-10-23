import type { Metadata } from "next";
import { Geist_Mono, Public_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { tr } from "@/i18n/dictionaries/tr";
import { SITE_NAME, TITLE_TEMPLATE } from "@/lib/page-titles";
import "./globals.css";

// Türkçe ğ, ş, ı, İ harfleri "latin-ext" alt kümesindedir
const publicSans = Public_Sans({
  variable: "--font-app-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-app-mono",
  subsets: ["latin", "latin-ext"],
});

const DESCRIPTION = "Saha ve proje operasyonları için harita tabanlı yönetim platformu";

export const metadata: Metadata = {
  title: {
    template: TITLE_TEMPLATE,
    default: `${SITE_NAME} | ${tr.pageTitle.home}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  metadataBase: new URL("https://koordine.com.tr"),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "tr_TR",
    title: SITE_NAME,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${publicSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Kayıtlı temayı ilk boyamadan önce uygula; açık temada koyu ekran parlamasını önler */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.classList.add("light")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex h-full min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
