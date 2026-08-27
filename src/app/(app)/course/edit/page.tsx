import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseEditForm } from "@/components/course-edit-form";
import { requireProfessor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types/domain";

export const metadata: Metadata = { title: "Editar curso" };

export default async function CourseEditPage() {
  await requireProfessor();
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id,title,description,cover_path").limit(1).maybeSingle();
  if (!data) notFound();
  const course = data as Course;

  return (
    <main className="container page">
      <div className="page-header">
        <div>
          <h1>Editar curso</h1>
          <p className="page-description">Atualize a identificação que todos veem na página principal.</p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: "46rem" }}>
        <CourseEditForm course={course} />
      </section>
    </main>
  );
}
