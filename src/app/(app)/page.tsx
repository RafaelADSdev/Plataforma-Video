import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, FilePlus2, Play, Settings2 } from "lucide-react";
import { createModuleAction, updateModuleAction } from "@/app/actions/course";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { ReorderButton } from "@/components/reorder-button";
import { requireUser } from "@/lib/auth";
import { storageFileUrl } from "@/lib/storage";
import { formatDateInSaoPaulo, formatDateTimeInSaoPaulo, formatVideoTime, isFutureDate } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, Module, Progress } from "@/types/domain";

export const metadata: Metadata = { title: "Curso" };

export default async function CourseHome({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const auth = await requireUser();
  const { editar } = await searchParams;
  const editMode = auth.isStaff && editar === "1";
  const supabase = await createClient();
  const [{ data: courseData }, { data: moduleData }, { data: lessonData }, { data: progressData }] = await Promise.all([
    supabase.from("courses").select("id,title,description,cover_path").limit(1).maybeSingle(),
    supabase.from("modules").select("id,course_id,title,position,scheduled_for").order("position"),
    supabase.from("lessons").select("id,module_id,title,content,youtube_url,position,requires_submission,published_at,scheduled_for").order("position"),
    auth.role === "aluno"
      ? supabase.from("lesson_progress").select("lesson_id,user_id,last_seconds,watched,updated_at").eq("user_id", auth.id)
      : Promise.resolve({ data: [] }),
  ]);

  const course = courseData as Course | null;
  const modules = (moduleData ?? []) as Module[];
  const lessons = (lessonData ?? []) as Lesson[];
  const progress = (progressData ?? []) as Progress[];
  const progressByLesson = new Map(progress.map((item) => [item.lesson_id, item]));
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const orderedLessons = modules.flatMap((module) => lessons.filter((lesson) => lesson.module_id === module.id));
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const resume = progress
    .filter((item) => !item.watched && item.last_seconds > 0 && lessonsById.has(item.lesson_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const nextLesson = (resume ? lessonsById.get(resume.lesson_id) : undefined)
    ?? orderedLessons.find((lesson) => !progressByLesson.get(lesson.id)?.watched);
  const finished = lessons.filter((lesson) => progressByLesson.get(lesson.id)?.watched).length;

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

      <section className={`study-feature${coverUrl ? " has-cover" : ""}`} aria-labelledby="study-feature-title">
        <div className="study-feature-copy">
          <p className="feature-label">
            {auth.isStaff ? <BookOpen size={17} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {auth.isStaff ? "Área do professor" : resume ? "Continue estudando" : nextLesson ? "Próxima aula" : "Seu curso"}
          </p>
          <h2 id="study-feature-title">{auth.isStaff ? "Organize o conteúdo" : nextLesson?.title ?? (lessons.length ? "Aulas em dia" : "Aulas em preparação")}</h2>
          {nextLesson && !auth.isStaff ? <p>{modulesById.get(nextLesson.module_id)?.title}{resume ? ` · Parou em ${formatVideoTime(resume.last_seconds)}` : ""}</p> : null}
          {auth.isStaff ? (
            <div className="cluster feature-actions">
              <Link className="button feature-button" href="/lessons/new"><FilePlus2 aria-hidden="true" size={17} /> Nova aula</Link>
              <Link className="button feature-secondary" href={editMode ? "/" : "/?editar=1"}>{editMode ? "Concluir organização" : "Organizar módulos"}</Link>
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
          <ActionForm action={createModuleAction} submitLabel="Criar módulo" pendingLabel="Criando…" fieldLabels={{ title: "Título", scheduled_for: "Data no cronograma" }}>
            <input type="hidden" name="course_id" value={course.id} />
            <div className="form-row">
              <div className="field"><label htmlFor="new-module-title">Título <span aria-hidden="true">*</span></label><input className="input" id="new-module-title" name="title" required minLength={2} maxLength={120} aria-required="true" /><p className="field-hint">Obrigatório.</p></div>
              <div className="field"><label htmlFor="new-module-date">Data no cronograma</label><input className="input" id="new-module-date" name="scheduled_for" type="date" lang="pt-BR" /><p className="field-hint">Opcional.</p></div>
            </div>
          </ActionForm>
        </section>
      ) : null}

      <div className="study-grid">
      <section aria-labelledby="modules-title" className="modules-section">
        <div className="section-heading"><h2 id="modules-title">Módulos e aulas</h2></div>
        {modules.length === 0 ? (
          <EmptyState title="O curso ainda não tem módulos" action={auth.isStaff ? <Link className="button" href="/?editar=1">Criar primeiro módulo</Link> : undefined}>
            <p>{auth.isStaff ? "Crie o primeiro módulo para começar a organizar as aulas." : "A organização ainda está preparando o conteúdo. Volte em breve."}</p>
          </EmptyState>
        ) : (
          <div className="module-list">
            {modules.map((module, moduleIndex) => {
              const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id).sort((a, b) => a.position - b.position);
              const moduleFinished = moduleLessons.filter((lesson) => progressByLesson.get(lesson.id)?.watched).length;
              return (
                <article className="module-block" key={module.id}>
                  <header className="module-header">
                    <div className="module-number" aria-hidden="true">{module.position}</div>
                    <div className="module-title-wrap">
                      <h3>{module.title}</h3>
                      {module.scheduled_for ? <p className="meta">No cronograma em {formatDateInSaoPaulo(module.scheduled_for)}</p> : null}
                    </div>
                    {!auth.isStaff && moduleLessons.length ? <span className="module-progress">{moduleFinished}/{moduleLessons.length} concluídas</span> : null}
                    {editMode ? (
                      <div className="reorder-pair" aria-label={`Reordenar módulo ${module.title}`}>
                        <ReorderButton kind="module" id={module.id} direction="up" disabled={moduleIndex === 0} />
                        <ReorderButton kind="module" id={module.id} direction="down" disabled={moduleIndex === modules.length - 1} />
                      </div>
                    ) : null}
                  </header>
                  {editMode ? (
                    <div className="module-inline-edit">
                      <ActionForm action={updateModuleAction.bind(null, module.id)} submitLabel="Salvar módulo" pendingLabel="Salvando…" className="module-edit-form" fieldLabels={{ title: "Título", scheduled_for: "Data no cronograma" }}>
                        <div className="field"><label htmlFor={`module-title-${module.id}`}>Título do módulo</label><input className="input" id={`module-title-${module.id}`} name="title" defaultValue={module.title} required minLength={2} maxLength={120} /></div>
                        <div className="field"><label htmlFor={`module-date-${module.id}`}>Data no cronograma</label><input className="input" id={`module-date-${module.id}`} name="scheduled_for" type="date" defaultValue={module.scheduled_for ?? ""} /></div>
                      </ActionForm>
                    </div>
                  ) : null}
                  {moduleLessons.length === 0 ? (
                    <p className="module-empty">Este módulo ainda não tem aulas. {auth.isStaff ? "Crie uma aula e selecione este módulo." : "O conteúdo será publicado em breve."}</p>
                  ) : (
                    <ol className="lesson-list">
                      {moduleLessons.map((lesson, lessonIndex) => {
                        const itemProgress = progressByLesson.get(lesson.id);
                        const future = isFutureDate(lesson.published_at);
                        return (
                          <li key={lesson.id} className="lesson-row">
                            <Link href={`/lessons/${lesson.id}`} className="lesson-link">
                              <span className="lesson-position">{lesson.position}</span>
                              <span className="lesson-main"><strong>{lesson.title}</strong><span className="lesson-meta">{lesson.youtube_url ? "Vídeo" : "Leitura"}{lesson.requires_submission ? " · Com entrega" : ""}</span></span>
                              <span className="lesson-status">
                                {itemProgress?.watched ? <span className="badge success"><Check aria-hidden="true" size={13} /> Vista</span> : itemProgress && itemProgress.last_seconds > 0 ? <span className="badge primary"><Clock3 aria-hidden="true" size={13} /> Em andamento</span> : null}
                                {auth.isStaff && future ? <span className="badge warning">Agendada · {formatDateTimeInSaoPaulo(lesson.published_at)}</span> : null}
                              </span>
                            </Link>
                            {editMode ? (
                              <div className="lesson-admin-actions">
                                <div className="reorder-pair">
                                  <ReorderButton kind="lesson" id={lesson.id} direction="up" disabled={lessonIndex === 0} />
                                  <ReorderButton kind="lesson" id={lesson.id} direction="down" disabled={lessonIndex === moduleLessons.length - 1} />
                                </div>
                                <Link className="button ghost small" href={`/lessons/${lesson.id}/edit`}>Editar</Link>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {!editMode ? (
        <aside className="study-side" aria-label="Links do curso">
          <section className="panel study-side-panel">
            <span className="study-side-icon"><CalendarDays size={21} aria-hidden="true" /></span>
            <h2>Cronograma</h2>
            <p className="muted">{auth.isStaff ? "Organize a semana recomendada para a turma." : "Consulte a semana recomendada e organize seus horários."}</p>
            <Link className="inline-link" href="/cronograma">Ver cronograma <ArrowRight size={17} aria-hidden="true" /></Link>
          </section>
        </aside>
      ) : null}
      </div>
    </main>
  );
}
