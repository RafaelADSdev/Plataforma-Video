import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonForm } from "@/components/lesson-form";
import { requireProfessor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFutureDate } from "@/lib/time";
import type { Lesson, Material, Module } from "@/types/domain";

export const metadata: Metadata = { title: "Editar aula" };

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfessor();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: lessonData }, { data: modulesData }, { data: materialsData }] = await Promise.all([
    supabase.from("lessons").select("id,module_id,title,content,youtube_url,position,published_at,scheduled_for").eq("id", id).maybeSingle(),
    supabase.from("modules").select("id,course_id,title,position,scheduled_for").order("position"),
    supabase.from("materials").select("id,lesson_id,name,storage_path,mime_type,size_bytes").eq("lesson_id", id).order("created_at"),
  ]);
  if (!lessonData) notFound();

  return (
    <main className="container page">
      <div className="page-header"><div><h1>Editar aula</h1><p className="page-description">As alterações aparecem para a turma conforme a data de publicação.</p></div></div>
      <section className="panel">
        <LessonForm lesson={lessonData as Lesson} modules={(modulesData ?? []) as Module[]} materials={(materialsData ?? []) as Material[]} scheduledPublication={isFutureDate((lessonData as Lesson).published_at)} />
      </section>
    </main>
  );
}
