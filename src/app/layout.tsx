import type { Metadata } from "next";
import Script from "next/script";
import { bricolage, inter } from "@/lib/fonts";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sala do Curso",
    template: "%s | Sala do Curso",
  },
  description: "Ambiente de estudo do cursinho para acompanhar aulas e atividades.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
