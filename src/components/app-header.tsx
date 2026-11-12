import Link from "next/link";
import { Bell } from "lucide-react";
import type { AuthContext } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

const roleLabels = {
  admin: "Administrador",
  professor: "Professor",
  aluno: "Aluno",
};

export function AppHeader({ auth, displayName }: { auth: AuthContext; displayName: string }) {
  return (
    <header className="workspace-header">
      <div className="workspace-top">
        <Link href="/" className="app-brand" aria-label="Sala do Curso, início">
          <BrandMark />
          <span className="app-name">Sala do Curso</span>
        </Link>
        <div className="workspace-mobile-actions">
          <Link className="icon-button" href="/notificacoes" aria-label="Notificações"><Bell size={19} aria-hidden="true" /></Link>
          <ThemeToggle />
        </div>
      </div>
      <NavLinks role={auth.role} />
      <div className="workspace-account">
        <Link href="/perfil" className="workspace-user">
          <span className="workspace-initial" aria-hidden="true">{displayName[0]?.toLocaleUpperCase("pt-BR") || "S"}</span>
          <span><strong>{displayName}</strong><small>{roleLabels[auth.role]}</small></span>
        </Link>
        <div className="workspace-account-actions"><ThemeToggle /><LogoutButton /></div>
      </div>
    </header>
  );
}
