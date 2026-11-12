import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PwaWorker } from "@/components/pwa-worker";
import { bricolage, inter } from "@/lib/fonts";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";
import "./learning.css";

export const metadata: Metadata = {
  title: {
    default: "Sala do Curso",
    template: "%s | Sala do Curso",
  },
  description: "Ambiente de estudo do cursinho para acompanhar aulas e atividades.",
  icons: {
    apple: { url: "/icons/sala-180.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  themeColor: "#173e33",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
        <PwaWorker />
      </body>
    </html>
  );
}
