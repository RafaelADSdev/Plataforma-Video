import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonForm } from "@/components/lesson-form";
import { requireProfessor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, Material, Module } from "@/types/domain";

export const metadata: Metadata = { title: "Editar aula" };

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfessor();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: lessonData }, { data: modulesData }, { data: materialsData }] = await Promise.all([
    supabase.from("lessons").select("id,module_id,title,content,video_status,position,published_at,scheduled_for").eq("id", id).maybeSingle(),
    supabase.from("modules").select("id,course_id,title,position,scheduled_for").order("position"),
    supabase.from("materials").select("id,lesson_id,name,storage_path,mime_type,size_bytes").eq("lesson_id", id).order("created_at"),
  ]);
  if (!lessonData) notFound();

  return (
    <main className="container page">
      <div className="lesson-breadcrumb"><Link href="/">Curso</Link><span aria-hidden="true">/</span><Link href={`/lessons/${id}`}>Visualizar aula</Link></div>
      <div className="page-header"><div><h1>Editar aula</h1><p className="page-description">{lessonData.title}</p></div></div>
      <LessonForm lesson={lessonData as Lesson} modules={(modulesData ?? []) as Module[]} materials={(materialsData ?? []) as Material[]} />
    </main>
  );
}
