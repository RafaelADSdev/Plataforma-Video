"use client";

import { inter, manrope } from "@/lib/fonts";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <main className="container page">
          <div className="empty-state">
            <h1>Algo saiu do esperado</h1>
            <p>Recarregue a aplicação para continuar.</p>
            <button className="button" type="button" onClick={() => reset()}>Recarregar</button>
          </div>
        </main>
      </body>
    </html>
  );
}
