import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ClipboardPlus, Clock3, FilePlus2, Lock } from "lucide-react";
import { ActivityIcon } from "@/components/activity-list";
import { EmptyState } from "@/components/empty-state";
import { NewActivityButton } from "@/components/new-activity-button";
import { ReorderButton } from "@/components/reorder-button";
import { activityKindLabel, activityPublication, type ActivitySummary } from "@/lib/activities";
import { requireUser } from "@/lib/auth";
import { hasReadyVideo } from "@/lib/course-lessons";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { formatDateInSaoPaulo } from "@/lib/time";
import type { CourseLesson, Progress } from "@/types/domain";

export const metadata: Metadata = { title: "Módulo" };

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  const { id } = await params;
  if (!postgresUuidSchema().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [moduleResult, lockResult] = await Promise.all([
    supabase.from("modules").select("id,title,description,scheduled_for").eq("id", id).maybeSingle(),
    auth.isStaff ? { data: null, error: null } : supabase.rpc("course_locked_modules").eq("id", id).maybeSingle(),
  ]);
  if (moduleResult.error || lockResult.error) throw new Error("Não foi possível carregar o módulo.");
  const courseModule = moduleResult.data;
  if (!courseModule) notFound();

  return (
    <main className="container page module-page">
      <Link className="inline-link module-back" href="/"><ArrowLeft size={17} aria-hidden="true" /> Voltar aos módulos</Link>
      <header className="page-header">
        <div>
          <h1>{courseModule.title}</h1>
          {courseModule.description ? <p className="page-description module-description">{courseModule.description}</p> : null}
          {courseModule.scheduled_for ? <p className="meta module-date">No cronograma em {formatDateInSaoPaulo(courseModule.scheduled_for)}</p> : null}
        </div>
        {auth.isStaff ? (
          <div className="cluster">
            <Link className="button" href={`/lessons/new?modulo=${id}`}><FilePlus2 size={17} aria-hidden="true" /> Nova aula</Link>
            <NewActivityButton className="button secondary" moduleId={id} icon={<ClipboardPlus size={17} aria-hidden="true" />} />
          </div>
        ) : null}
      </header>
      {lockResult.data ? (
        <EmptyState title="Módulo bloqueado">
          <p>Conclua as aulas dos módulos anteriores para liberar este módulo.</p>
        </EmptyState>
      ) : <ModuleContents id={id} staff={auth.isStaff} userId={auth.id} />}
    </main>
  );
}

type ModuleActivity = Pick<ActivitySummary, "id" | "lesson_id" | "kind" | "title" | "position" | "published_at">;

async function ModuleContents({ id, staff, userId }: { id: string; staff: boolean; userId: string }) {
  const supabase = await createClient();
  const [lessonResult, activityResult] = await Promise.all([
    supabase.rpc("course_lesson_catalog", { p_module_id: id }).order("position").order("id"),
    supabase.from("activities").select("id,lesson_id,kind,title,position,published_at").eq("module_id", id).order("position").order("id"),
  ]);
  if (lessonResult.error || activityResult.error) throw new Error("Não foi possível carregar o conteúdo do módulo.");

  const lessons = (lessonResult.data ?? []) as CourseLesson[];
  const activities = (activityResult.data ?? []) as ModuleActivity[];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const progressResult = !staff && lessonIds.length
    ? await supabase.from("lesson_progress").select("lesson_id,last_seconds,watched").eq("user_id", userId).in("lesson_id", lessonIds)
    : { data: [], error: null };
  if (progressResult.error) throw new Error("Não foi possível carregar o progresso do módulo.");

  const linkedLessonIds = new Set(activities.map((activity) => activity.lesson_id));
  const progressByLesson = new Map(((progressResult.data ?? []) as Pick<Progress, "lesson_id" | "last_seconds" | "watched">[])
    .map((entry) => [entry.lesson_id, entry]));
  const items = [
    ...lessons.map((lesson) => ({ type: "lesson" as const, ...lesson })),
    ...activities.filter((activity) => !activity.lesson_id).map((activity) => ({ type: "activity" as const, ...activity })),
  ].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

  return (
    <section aria-labelledby="module-contents-title">
      <div className="section-heading"><h2 id="module-contents-title">Aulas e atividades</h2></div>
      <div className="module-block">
        {items.length === 0 ? (
          <p className="module-empty">{staff ? "Adicione uma aula ou atividade a este módulo." : "As aulas e atividades aparecem aqui quando forem publicadas."}</p>
        ) : (
          <ol className="lesson-list" role="list">
            {items.map((item, index) => {
              const isLesson = item.type === "lesson";
              const progress = isLesson ? progressByLesson.get(item.id) : undefined;
              const publication = activityPublication(item.published_at);
              const href = isLesson ? `/lessons/${item.id}` : `/atividades/${item.id}`;
              const locked = isLesson && Boolean(item.lock_reason);
              const kind = isLesson
                ? hasReadyVideo(item) ? "Vídeo" : item.video_status === "none" ? "Leitura" : "Vídeo em preparação"
                : activityKindLabel(item.kind);
              const row = (
                <>
                  <span className="lesson-position" aria-hidden="true">{isLesson ? index + 1 : <ActivityIcon kind={item.kind} />}</span>
                  <span className="lesson-main">
                    <strong>{item.title}</strong>
                    <span className="lesson-meta">
                      {locked ? "Conclua as aulas anteriores para liberar" : kind}
                      {isLesson && !locked && linkedLessonIds.has(item.id) ? " · Com atividade" : null}
                    </span>
                  </span>
                  <span className="lesson-status">
                    {locked ? <span className="badge warning"><Lock size={13} aria-hidden="true" /> Bloqueada</span> : null}
                    {!locked && progress?.watched ? <span className="badge success"><Check size={13} aria-hidden="true" /> Concluída</span> : null}
                    {!locked && progress && !progress.watched && progress.last_seconds > 0 ? <span className="badge primary"><Clock3 size={13} aria-hidden="true" /> Em andamento</span> : null}
                    {staff ? <span className={`badge ${publication.tone}`}>{publication.label}</span> : null}
                  </span>
                </>
              );

              return (
                <li key={`${item.type}-${item.id}`} className="lesson-row">
                  {locked ? <div className="lesson-link">{row}</div> : <Link href={href} className="lesson-link">{row}</Link>}
                  {staff ? (
                    <div className="lesson-admin-actions">
                      <div className="reorder-pair" role="group" aria-label={`Reordenar ${item.title}`}>
                        <ReorderButton kind={item.type} moduleId={id} id={item.id} direction="up" disabled={index === 0} />
                        <ReorderButton kind={item.type} moduleId={id} id={item.id} direction="down" disabled={index === items.length - 1} />
                      </div>
                      <Link className="button ghost small" aria-label={`Editar ${item.title}`} href={`${href}/${isLesson ? "edit" : "editar"}`}>Editar</Link>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
