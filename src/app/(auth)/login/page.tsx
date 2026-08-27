import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="login-shell">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <div className="login-stage">
        <aside className="login-intro">
          <p className="login-brand">
            <BrandMark />
            Sala do Curso
          </p>
          <p className="login-lede">Aulas, materiais, progresso e comunidade em um só lugar.</p>
        </aside>
        <section className="login-card" aria-labelledby="login-title">
          <div>
            <h1 id="login-title">Entre na sua conta</h1>
            <p className="page-description">Use o e-mail e a senha fornecidos pela organização.</p>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
