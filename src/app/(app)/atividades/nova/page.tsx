import type { Metadata } from "next";
import Link from "next/link";
import { ActivityAuthoring } from "@/components/activity-authoring";
import { ActivityFormatOptions } from "@/components/new-activity-button";
import { requireProfessor } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova atividade" };

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ aula?: string; modulo?: string; tipo?: string }> }) {
  const { aula, modulo, tipo } = await searchParams;
  if (tipo === "file" || tipo === "quiz") {
    return <ActivityAuthoring lessonId={aula} moduleId={modulo} kind={tipo} />;
  }

  await requireProfessor();
  return (
    <main className="container page">
      <nav className="lesson-breadcrumb" aria-label="Localização"><Link href="/atividades">Atividades</Link></nav>
      <header className="page-header"><h1>Nova atividade</h1></header>
      <ActivityFormatOptions lessonId={typeof aula === "string" ? aula : undefined} moduleId={typeof modulo === "string" ? modulo : undefined} />
    </main>
  );
}
