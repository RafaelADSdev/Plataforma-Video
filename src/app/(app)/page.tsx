import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardPlus, FilePlus2, Lock, Play, Settings2 } from "lucide-react";
import { createModuleAction, updateModuleAction } from "@/app/actions/course";
import { ActionForm } from "@/components/action-form";
import { ActivitySidePanel } from "@/components/activity-list";
import { EmptyState } from "@/components/empty-state";
import { ModuleFields, moduleFieldLabels } from "@/components/module-fields";
import { NewActivityButton } from "@/components/new-activity-button";
import { ReorderButton } from "@/components/reorder-button";
import { ScheduleSidePanel } from "@/components/schedule-side-panel";
import { requireUser } from "@/lib/auth";
import { hasReadyVideo } from "@/lib/course-lessons";
import { storageFileUrl } from "@/lib/storage";
import { formatVideoTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Course, CourseLesson, Progress } from "@/types/domain";

export const metadata: Metadata = { title: "Curso" };

export default async function CourseHome({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const auth = await requireUser();
  const { editar } = await searchParams;
  const editMode = auth.isStaff && editar === "1";
  const supabase = await createClient();
  const [courseResult, moduleResult, lessonResult, progressResult, moduleLocksResult] = await Promise.all([
    supabase.from("courses").select("id,title,description,cover_path").limit(1).maybeSingle(),
    supabase.from("modules").select("id,title,description,position,scheduled_for,lessons_in_order,require_previous_modules").order("position").order("id"),
    supabase.rpc("course_lesson_catalog").order("position").order("id"),
    auth.role === "aluno"
      ? supabase.from("lesson_progress").select("lesson_id,user_id,last_seconds,watched,updated_at").eq("user_id", auth.id)
      : Promise.resolve({ data: [], error: null }),
    auth.isStaff ? { data: [], error: null } : supabase.rpc("course_locked_modules"),
  ]);
  if (courseResult.error || moduleResult.error || lessonResult.error || progressResult.error || moduleLocksResult.error) {
    throw new Error("Não foi possível carregar o curso.");
  }
  const course = courseResult.data as Course | null;
  const modules = moduleResult.data ?? [];
  const lessons = (lessonResult.data ?? []) as CourseLesson[];
  const lockedModules = new Set((moduleLocksResult.data ?? []).map((module: { id: string }) => module.id));
  const progress = (progressResult.data ?? []) as Progress[];
  const progressByLesson = new Map(progress.map((item) => [item.lesson_id, item]));
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const unlockedLessons = lessons.filter((lesson) => !lesson.lock_reason);
  const orderedLessons = modules.flatMap((module) => unlockedLessons.filter((lesson) => lesson.module_id === module.id));
  const lessonsById = new Map(unlockedLessons.map((lesson) => [lesson.id, lesson]));
  const resume = progress
    .filter((item) => !item.watched && item.last_seconds > 0 && hasReadyVideo(lessonsById.get(item.lesson_id)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const nextLesson = (resume ? lessonsById.get(resume.lesson_id) : undefined)
    ?? orderedLessons.find((lesson) => (lesson.video_status === "none" || hasReadyVideo(lesson)) && !progressByLesson.get(lesson.id)?.watched);
  const finished = lessons.filter((lesson) => progressByLesson.get(lesson.id)?.watched).length;
  const allFinished = lessons.length > 0 && finished === lessons.length;

  if (!course) {
    return <main className="container page"><EmptyState title="Curso não configurado"><p>Aplique a migração inicial do Supabase para criar o curso.</p></EmptyState></main>;
  }

  const coverUrl = storageFileUrl("covers", course.cover_path);

  return (
    <main className="container page study-home">
      <header className="study-heading">
        <div>
          <h1>{course.title}</h1>
          {course.description ? <p className="page-description">{course.description}</p> : null}
        </div>
        {auth.isStaff ? <Link className="button secondary" href="/course/edit"><Settings2 size={17} aria-hidden="true" /> Dados do curso</Link> : null}
      </header>

      <section className="study-feature" aria-labelledby="study-feature-title">
        <div className="study-feature-copy">
          <p className="feature-label">
            {auth.isStaff ? <BookOpen size={17} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {auth.isStaff ? "Área do professor" : resume ? "Continue estudando" : nextLesson ? "Próxima aula" : "Seu curso"}
          </p>
          <h2 id="study-feature-title">{auth.isStaff ? "Organize o conteúdo" : nextLesson?.title ?? (allFinished ? "Aulas em dia" : "Aulas em preparação")}</h2>
          {nextLesson && !auth.isStaff ? <p>{modulesById.get(nextLesson.module_id)?.title}{resume ? ` · Parou em ${formatVideoTime(resume.last_seconds)}` : ""}</p> : null}
          {auth.isStaff ? (
            <div className="cluster feature-actions">
              <Link className="button feature-button" href="/lessons/new"><FilePlus2 aria-hidden="true" size={17} /> Nova aula</Link>
              <NewActivityButton className="button feature-secondary" icon={<ClipboardPlus size={17} aria-hidden="true" />} />
              {editMode ? (
                <Link className="button feature-secondary" href="/"><ArrowLeft size={17} aria-hidden="true" /> Voltar ao curso</Link>
              ) : (
                <Link className="button feature-secondary" href="/?editar=1">Organizar módulos</Link>
              )}
            </div>
          ) : nextLesson ? (
            <Link className="button feature-button" href={`/lessons/${nextLesson.id}`}>{resume ? "Retomar aula" : "Começar aula"}<ArrowRight aria-hidden="true" size={18} /></Link>
          ) : null}
        </div>
        {coverUrl ? (
          <div className="study-cover"><Image src={coverUrl} alt={`Capa de ${course.title}`} fill sizes="(max-width: 600px) 85vw, 380px" unoptimized priority /></div>
        ) : (
          <div className="study-stat">
            <span>{auth.isStaff ? "Conteúdo do curso" : "Aulas concluídas"}</span>
            <strong>{auth.isStaff ? lessons.length : finished}<small>{auth.isStaff ? (lessons.length === 1 ? " aula" : " aulas") : ` / ${lessons.length}`}</small></strong>
            {auth.isStaff ? <span>{modules.length} {modules.length === 1 ? "módulo" : "módulos"}</span> : (
              <progress aria-label="Progresso no curso" value={finished} max={Math.max(1, lessons.length)} />
            )}
          </div>
        )}
      </section>

      {editMode ? (
        <section className="panel module-create">
          <div><h2>Novo módulo</h2><p className="muted">Crie o grupo antes de adicionar suas aulas.</p></div>
          <ActionForm action={createModuleAction} submitLabel="Criar módulo" pendingLabel="Criando…" fieldLabels={moduleFieldLabels}>
            <input type="hidden" name="course_id" value={course.id} />
            <ModuleFields fieldId="new-module" />
          </ActionForm>
        </section>
      ) : null}

      <div className="study-grid">
        <section aria-labelledby="modules-title" className="modules-section">
          <div className="section-heading"><h2 id="modules-title">Módulos do curso</h2></div>
          {modules.length === 0 ? (
            <EmptyState title="O curso ainda não tem módulos" action={auth.isStaff ? <Link className="button" href="/?editar=1">Criar primeiro módulo</Link> : undefined}>
              <p>{auth.isStaff ? "Crie o primeiro módulo para começar a organizar as aulas." : "A organização ainda está preparando o conteúdo. Volte em breve."}</p>
            </EmptyState>
          ) : (
            <div className="module-list">
              {modules.map((module, moduleIndex) => (
                <article className="module-block" key={module.id}>
                  <header className="module-summary">
                    <Link className="module-summary-link" href={`/course/modules/${module.id}`}>
                      <div className="module-title-wrap">
                        <h3>{module.title}</h3>
                        {module.description ? <p className="module-description">{module.description}</p> : null}
                      </div>
                      {lockedModules.has(module.id) ? (
                        <span className="badge warning"><Lock size={13} aria-hidden="true" /> Bloqueado</span>
                      ) : null}
                      <ArrowRight className="module-summary-arrow" size={19} aria-hidden="true" />
                    </Link>
                    {editMode ? (
                      <div className="reorder-pair" role="group" aria-label={`Reordenar módulo ${module.title}`}>
                        <ReorderButton kind="module" id={module.id} direction="up" disabled={moduleIndex === 0} />
                        <ReorderButton kind="module" id={module.id} direction="down" disabled={moduleIndex === modules.length - 1} />
                      </div>
                    ) : null}
                  </header>
                  {editMode ? (
                    <div className="module-inline-edit">
                      <ActionForm action={updateModuleAction.bind(null, module.id)} submitLabel="Salvar módulo" fieldLabels={moduleFieldLabels}>
                        <ModuleFields fieldId={`module-${module.id}`} module={module} />
                      </ActionForm>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
        {!editMode ? (
          <aside className="study-side" aria-label="Links do curso">
            <ActivitySidePanel staff={auth.isStaff} />
            <ScheduleSidePanel courseId={course.id} userId={auth.id} />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
