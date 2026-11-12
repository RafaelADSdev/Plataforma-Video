import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, ClipboardList } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="login-shell">
      <div className="login-stage">
        <aside className="login-intro">
          <p className="login-brand">
            <BrandMark />
            Sala do Curso
          </p>
          <div className="login-intro-copy">
            <p className="login-lede">Sua sala<br />de estudo.</p>
            <p className="login-description">Acesse as aulas e atividades do seu cursinho.</p>
          </div>
          <div className="login-illustration" aria-hidden="true">
            <BookOpen size={34} strokeWidth={1.5} />
            <ClipboardList size={35} strokeWidth={1.5} />
            <ArrowUpRight size={36} strokeWidth={1.5} />
          </div>
        </aside>
        <section className="login-card" aria-labelledby="login-title">
          <div>
            <h1 id="login-title">Entre na sua conta</h1>
            <p className="page-description">Use o e-mail e a senha fornecidos pela organização.</p>
          </div>
          <LoginForm />
        </section>
      </div>
      <div className="login-theme">
        <ThemeToggle />
      </div>
    </main>
  );
}
