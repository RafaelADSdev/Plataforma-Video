import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Download, FileText, Lock, Pencil, Plus } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { EmptyState } from "@/components/empty-state";
import { LessonExperience } from "@/components/lesson-experience";
import { NewActivityButton } from "@/components/new-activity-button";
import { activityPublication, activitySummaryColumns, type ActivitySummary } from "@/lib/activities";
import { requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { storageFileUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { Comment, CourseLesson, Lesson, Material, Profile, Progress } from "@/types/domain";

export const metadata: Metadata = { title: "Aula" };

export default async function LessonPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversa?: string }>;
}) {
  const auth = await requireUser();
  const { id } = await params;
  if (!postgresUuidSchema().safeParse(id).success) notFound();
  const { conversa } = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, materialsResult, commentsResult, activitiesResult] = await Promise.all([
    supabase.from("lessons").select("id,module_id,title,content,video_status,youtube_video_id,position,published_at,scheduled_for").eq("id", id).maybeSingle(),
    supabase.from("materials").select("id,lesson_id,name,storage_path,mime_type,size_bytes").eq("lesson_id", id).order("created_at"),
    supabase.from("lesson_comments").select("id,lesson_id,author_id,body,t_seconds,created_at").eq("lesson_id", id).order("created_at"),
    supabase.from("activities").select(activitySummaryColumns).eq("lesson_id", id).order("created_at"),
  ]);
  if (error) throw new Error("Não foi possível carregar a aula.");
  if (!data) {
    const { data: entry, error: catalogError } = await supabase.rpc("course_lesson_catalog", { p_lesson_id: id }).maybeSingle<CourseLesson>();
    if (catalogError) throw new Error("Não foi possível carregar a aula.");
    if (!entry?.lock_reason) notFound();
    return (
      <main className="container page">
        <EmptyState title="Aula bloqueada" action={<Link className="button" href={`/course/modules/${entry.module_id}`}>Voltar ao módulo</Link>}>
          <p><strong>{entry.title}</strong></p>
          <p>{entry.lock_reason === "module" ? "Conclua as aulas dos módulos anteriores para acessar esta aula." : "Conclua as aulas anteriores deste módulo para acessar esta aula."}</p>
        </EmptyState>
      </main>
    );
  }
  if (materialsResult.error || commentsResult.error || activitiesResult.error) throw new Error("Não foi possível carregar o conteúdo da aula.");
  const lesson = data as Lesson;
  const activities = (activitiesResult.data ?? []) as ActivitySummary[];
  const legacyActivity = activities.find((item) => item.id === id);
  if (legacyActivity && postgresUuidSchema().safeParse(conversa).success) {
    redirect(`/atividades/${legacyActivity.id}?conversa=${conversa}`);
  }
  const [moduleResult, curriculumResult, progressResult] = await Promise.all([
    supabase.from("modules").select("title").eq("id", lesson.module_id).maybeSingle(),
    supabase.rpc("course_lesson_catalog", { p_module_id: lesson.module_id }).order("position").order("id"),
    auth.isStaff ? { data: [], error: null } : supabase.from("lesson_progress").select("lesson_id,last_seconds,watched").eq("user_id", auth.id),
  ]);
  if (curriculumResult.error || progressResult.error) throw new Error("Não foi possível carregar o progresso da aula.");
  const curriculum = (curriculumResult.data ?? []) as CourseLesson[];
  const progressByLesson = new Map(((progressResult.data ?? []) as Progress[]).map((item) => [item.lesson_id, item]));
  const progress = progressByLesson.get(id);
  const position = curriculum.findIndex((item) => item.id === id);
  const requiresPlayback = curriculum[position]?.requires_playback ?? false;
  const previous = position > 0 ? curriculum[position - 1] : undefined;
  const next = curriculum[position + 1];
  const comments = (commentsResult.data ?? []) as Comment[];
  const authorIds = [...new Set(comments.map((item) => item.author_id))];
  const { data: profileData } = authorIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_path").in("id", authorIds)
    : { data: [] };
  const profiles = new Map(((profileData ?? []) as Profile[]).map((item) => [item.id, item]));
  const commentsWithProfiles = comments.map((item) => ({ ...item, profiles: profiles.get(item.author_id) ?? null }));
  const materials = (materialsResult.data ?? []) as Material[];
  const publication = activityPublication(lesson.published_at);

  return (
    <main className="container page lesson-page">
      <nav className="lesson-breadcrumb" aria-label="Localização"><Link href="/">Curso</Link><span aria-hidden="true">/</span><Link href={`/course/modules/${lesson.module_id}`}>{moduleResult.data?.title ?? "Módulo"}</Link></nav>
      <header className="page-header lesson-page-header">
        <div>
          <p className="content-type"><BookOpen size={18} aria-hidden="true" /> {position >= 0 ? `Aula ${position + 1} de ${curriculum.length}` : "Aula"}</p>
          <h1>{lesson.title}</h1>
          {auth.isStaff ? <span className={`badge ${publication.tone}`}>{publication.label}</span> : null}
        </div>
        {auth.isStaff ? <Link className="button secondary" href={`/lessons/${id}/edit`}><Pencil aria-hidden="true" size={17} /> Editar aula</Link> : null}
      </header>

      <div className="classroom-grid">
        <LessonExperience
          key={id}
          lessonId={id} lessonTitle={lesson.title} videoStatus={lesson.video_status} youtubeVideoId={lesson.youtube_video_id}
          initialSeconds={progress?.last_seconds ?? 0} initialWatched={progress?.watched ?? false}
          canTrack={auth.role === "aluno"} requiresPlayback={requiresPlayback} comments={commentsWithProfiles}
          curriculum={(
            <aside className="classroom-index">
              <details open>
                <summary><span>Índice de aulas</span><ChevronDown size={18} aria-hidden="true" /></summary>
                <ol>
                  {curriculum.map((item, index) => (
                    <li key={item.id}>
                      {item.lock_reason ? (
                        <div className="classroom-locked"><span className="lesson-position"><Lock size={15} aria-label="Bloqueada" /></span><span>{item.title}</span></div>
                      ) : (
                        <Link href={`/lessons/${item.id}`} aria-current={item.id === id ? "page" : undefined}>
                          <span className="lesson-position">{progressByLesson.get(item.id)?.watched ? <Check size={15} aria-label="Concluída" /> : index + 1}</span>
                          <span>{item.title}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
              <div className="classroom-prev-next">
                {previous && !previous.lock_reason ? <Link href={`/lessons/${previous.id}`} aria-label={`Aula anterior: ${previous.title}`}><ArrowLeft size={16} aria-hidden="true" /> Anterior</Link> : <span />}
                {next?.lock_reason ? <span className="meta">Próxima aula bloqueada</span> : next ? <Link href={`/lessons/${next.id}`} aria-label={`Próxima aula: ${next.title}`}>Próxima <ArrowRight size={16} aria-hidden="true" /></Link> : null}
              </div>
            </aside>
          )}
        >
          <nav aria-label="Seções da aula" className="classroom-sections">
            <a href="#sobre">Aula</a><a href="#materiais">Materiais</a><a href="#atividades-da-aula">Atividades</a><a href="#comments-title">Comentários</a>
          </nav>
          <article className="lesson-body">
            <section aria-labelledby="sobre"><h2 id="sobre">Sobre a aula</h2>{lesson.content ? <div className="reading">{lesson.content}</div> : <p className="muted">Sem texto complementar.</p>}</section>
            <section aria-labelledby="materiais"><h2 id="materiais">Materiais</h2>
              {materials.length ? <ul className="download-list">{materials.map((material) => (
                <li key={material.id}>
                  <FileText aria-hidden="true" size={19} />
                  <span><strong>{material.name}</strong><small>PDF · {Math.max(1, Math.round(material.size_bytes / 1024))} KB</small></span>
                  <Link className="button secondary small" href={`${storageFileUrl("materials", material.storage_path)}?nome=${encodeURIComponent(material.name)}`} target="_blank" rel="noreferrer"><Download aria-hidden="true" size={16} /> Abrir PDF</Link>
                </li>
              ))}</ul> : <p className="muted">Esta aula ainda não tem materiais anexados.</p>}
            </section>
            <section aria-labelledby="atividades-da-aula">
              <div className="section-heading">
                <h2 id="atividades-da-aula">Atividades</h2>
                {auth.isStaff ? <NewActivityButton lessonId={id} className="button secondary small" icon={<Plus size={16} aria-hidden="true" />} /> : null}
              </div>
              {activities.length ? <ActivityList items={activities} staff={auth.isStaff} /> : <p className="muted">Nenhuma atividade vinculada a esta aula.</p>}
            </section>
          </article>
        </LessonExperience>
      </div>
    </main>
  );
}
