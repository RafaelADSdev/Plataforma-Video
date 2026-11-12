import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { ChevronDown } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { PwaInstall } from "@/components/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import "./login.css";

export const metadata: Metadata = { title: "Entrar" };

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-login-serif",
  display: "swap",
  preload: false,
});

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-access">
        <a className="skip-link" href="#login-title">Pular para o acesso</a>
        <header className="login-header">
          <p className="login-brand">
            <BrandMark />
            Sala do Curso
          </p>
          <ThemeToggle />
        </header>

        <main className="login-card" aria-labelledby="login-title">
          <div className="login-heading">
            <h1 id="login-title" tabIndex={-1}>Entre na sua conta</h1>
            <p>Use o e-mail e a senha que a equipe do curso forneceu.</p>
          </div>
          <LoginForm />
          <details className="login-help">
            <summary>
              Precisa de ajuda para entrar?
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>Fale com a equipe do curso para confirmar seu e-mail ou pedir uma nova senha.</p>
          </details>
        </main>

        <PwaInstall />
      </div>

      <aside className={`login-feature ${instrumentSerif.variable}`} aria-label="Sobre a Sala do Curso">
        <div className="login-feature-copy">
          <p className="login-lede">Seu cursinho,<br /><em>em um só lugar.</em></p>
          <p className="login-description">Retome aulas, consulte materiais e acompanhe suas atividades.</p>
        </div>
      </aside>
    </div>
  );
}
