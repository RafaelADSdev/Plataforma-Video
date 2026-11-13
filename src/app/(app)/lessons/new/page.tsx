import type { Metadata } from "next";
import Link from "next/link";
import { LessonForm } from "@/components/lesson-form";
import { EmptyState } from "@/components/empty-state";
import { requireProfessor } from "@/lib/auth";
import { isStreamUploadConfigured } from "@/lib/cloudflare-stream";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova aula" };

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  await requireProfessor();
  const { modulo } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("modules").select("id,title").order("position").order("id");
  if (error) throw new Error("Não foi possível carregar os módulos.");
  const modules = data ?? [];
  const selectedModule = modules.find((module) => module.id === modulo);

  return (
    <main className="container page">
      <nav className="lesson-breadcrumb" aria-label="Localização">
        <Link href="/">Curso</Link>
        {selectedModule ? <><span aria-hidden="true">/</span><Link href={`/course/modules/${selectedModule.id}`}>{selectedModule.title}</Link></> : null}
      </nav>
      <div className="page-header"><div><h1>Nova aula</h1><p className="page-description">Prepare o conteúdo da aula e escolha quando a turma poderá acessá-la.</p></div></div>
      {modules.length === 0 ? (
        <EmptyState title="Crie um módulo primeiro" action={<Link className="button" href="/?editar=1">Organizar curso</Link>}>
          <p>A aula precisa pertencer a um módulo. Volte ao curso e crie o primeiro.</p>
        </EmptyState>
      ) : <LessonForm modules={modules} initialModuleId={selectedModule?.id} streamUploadAvailable={isStreamUploadConfigured()} />}
    </main>
  );
}
