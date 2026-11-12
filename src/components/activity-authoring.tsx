import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityEditor } from "@/components/activity-editor";
import { EmptyState } from "@/components/empty-state";
import { activityColumns, activityKindLabel } from "@/lib/activities";
import { requireProfessor } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityQuiz, Module } from "@/types/domain";

export async function ActivityAuthoring({ id, lessonId }: { id?: string; lessonId?: string }) {
  await requireProfessor();
  if (id && !postgresUuidSchema().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [modulesResult, lessonsResult, activityResult] = await Promise.all([
    supabase.from("modules").select("id,course_id,title,position,scheduled_for").order("position").order("id"),
    supabase.from("lessons").select("id,module_id,title").order("position").order("id"),
    id ? supabase.from("activities").select(activityColumns).eq("id", id).maybeSingle() : { data: null, error: null },
  ]);
  if (modulesResult.error || lessonsResult.error || activityResult.error) throw new Error("Não foi possível abrir o editor de atividade.");
  if (id && !activityResult.data) notFound();
  const activity = activityResult.data as Activity | null;
  const modules = (modulesResult.data ?? []) as Module[];
  const lessons = lessonsResult.data ?? [];
  const initialLessonId = lessons.some((lesson) => lesson.id === lessonId) ? lessonId : undefined;
  const quizResult = activity?.kind === "quiz" ? await supabase.rpc("read_activity_quiz", { p_activity_id: activity.id }) : null;
  if (quizResult?.error || (activity?.kind === "quiz" && !quizResult?.data)) throw new Error("Não foi possível carregar as questões.");
  return (
    <main className="container page">
      <div className="lesson-breadcrumb"><Link href="/atividades">Atividades</Link></div>
      <header className="page-header"><div><h1>{activity ? "Editar atividade" : "Nova atividade"}</h1>
        {activity ? <p className="page-description">{activityKindLabel(activity.kind)} · {activity.title}</p> : null}
      </div></header>
      {modules.length ? (
        <ActivityEditor modules={modules} lessons={lessons} activity={activity ?? undefined} quiz={quizResult?.data as ActivityQuiz | null} initialLessonId={initialLessonId} />
      ) : <EmptyState title="Crie um módulo primeiro" action={<Link className="button" href="/?editar=1">Organizar curso</Link>}><p>Uma atividade precisa pertencer a um módulo.</p></EmptyState>}
    </main>
  );
}
