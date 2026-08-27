import type { Metadata } from "next";
import Link from "next/link";
import { LessonForm } from "@/components/lesson-form";
import { EmptyState } from "@/components/empty-state";
import { requireProfessor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Module } from "@/types/domain";

export const metadata: Metadata = { title: "Nova aula" };

export default async function NewLessonPage() {
  await requireProfessor();
  const supabase = await createClient();
  const { data } = await supabase.from("modules").select("id,course_id,title,position,scheduled_for").order("position");
  const modules = (data ?? []) as Module[];

  return (
    <main className="container page">
      <div className="page-header"><div><h1>Nova aula</h1><p className="page-description">Publique o conteúdo, o vídeo, os PDFs e a data desta aula.</p></div></div>
      {modules.length === 0 ? (
        <EmptyState title="Crie um módulo primeiro" action={<Link className="button" href="/?editar=1">Organizar curso</Link>}>
          <p>A aula precisa pertencer a um módulo. Volte ao curso e crie o primeiro.</p>
        </EmptyState>
      ) : <section className="panel"><LessonForm modules={modules} /></section>}
    </main>
  );
}
