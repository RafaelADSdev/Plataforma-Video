"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

const commonLinks = [
  { href: "/", label: "Curso", exact: true },
  { href: "/comunidade", label: "Comunidade" },
  { href: "/cronograma", label: "Cronograma" },
  { href: "/perfil", label: "Perfil" },
];

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = [
    ...commonLinks,
    ...(role === "professor" || role === "admin"
      ? [
          { href: "/notificacoes", label: "Notificações" },
          { href: "/alunos", label: "Alunos" },
        ]
      : []),
    ...(role === "admin" ? [{ href: "/admin/users", label: "Admin" }] : []),
  ];

  return (
    <nav aria-label="Navegação principal" className="main-nav">
      {links.map((link) => {
        const active = "exact" in link && link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
