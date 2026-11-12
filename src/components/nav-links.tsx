"use client";

import Link from "next/link";
import { Bell, BookOpen, CalendarDays, ClipboardList, Ellipsis, MessageCircle, ShieldCheck, UserRound, Users, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import type { Role } from "@/lib/auth";

type Destination = { href: string; label: string; Icon: LucideIcon };

const primary: Destination[] = [
  { href: "/", label: "Curso", Icon: BookOpen },
  { href: "/atividades", label: "Atividades", Icon: ClipboardList },
  { href: "/cronograma", label: "Cronograma", Icon: CalendarDays },
];
const community = { href: "/comunidade", label: "Comunidade", Icon: MessageCircle };
const notifications = { href: "/notificacoes", label: "Notificações", Icon: Bell };
const students = { href: "/alunos", label: "Alunos", Icon: Users };
const admin = { href: "/admin/users", label: "Contas", Icon: ShieldCheck };
const profile = { href: "/perfil", label: "Meu perfil", Icon: UserRound };

function isCurrent(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/lessons/") || path.startsWith("/course/");
  return path === href || path.startsWith(`${href}/`);
}

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const staff = role !== "aluno";
  const management = staff ? [notifications, students, ...(role === "admin" ? [admin] : [])] : [];
  const more = [community, ...management, ...(!staff ? [notifications] : []), profile];
  const link = ({ href, label, Icon }: Destination) => (
    <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined}>
      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      <nav aria-label="Navegação principal" className="workspace-nav">
        <div className="nav-group">
          <span className="nav-group-label">{staff ? "Curso" : "Estudo"}</span>
          {primary.map(link)}
          {link(community)}
          {!staff ? link(notifications) : null}
        </div>
        {management.length > 0 ? <div className="nav-group"><span className="nav-group-label">Gestão</span>{management.map(link)}</div> : null}
      </nav>
      <nav aria-label="Navegação no celular" className="mobile-nav">
        {primary.map(link)}
        <details className="mobile-more" key={pathname}>
          <summary className={more.some(({ href }) => isCurrent(pathname, href)) ? "mobile-more-active" : undefined}>
            <Ellipsis size={19} aria-hidden="true" /><span>Mais</span>
          </summary>
          <div className="mobile-more-panel">
            {more.map(link)}
            <div className="mobile-signout"><LogoutButton /><span>Sair da conta</span></div>
          </div>
        </details>
      </nav>
    </>
  );
}
