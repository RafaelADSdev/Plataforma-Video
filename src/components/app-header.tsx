import Link from "next/link";
import type { AuthContext } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

const roleLabels = {
  admin: "Admin",
  professor: "Professor",
  aluno: "Aluno",
};

export function AppHeader({ auth, displayName }: { auth: AuthContext; displayName: string }) {
  return (
    <header className="app-header">
      <div className="container header-row">
        <Link href="/" className="app-brand">
          <BrandMark />
          <span className="app-name">Sala do Curso</span>
        </Link>
        <NavLinks role={auth.role} />
        <div className="account-summary">
          <span className="account-text">
            <span>{displayName}</span>
            <span className="account-role">{roleLabels[auth.role]}</span>
          </span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
