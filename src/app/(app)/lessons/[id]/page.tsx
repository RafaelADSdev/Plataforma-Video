import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Download, FileText, Pencil } from "lucide-react";
import { LessonExperience } from "@/components/lesson-experience";
import { SubmissionConversationDialog } from "@/components/submission-conversation";
import { SubmissionForm } from "@/components/submission-form";
import { requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { publicDisplayName } from "@/lib/profile-name";
import { storageFileUrl } from "@/lib/storage";
import { listSubmissionMessages } from "@/lib/submission-messages";
import { formatDateTimeInSaoPaulo, isFutureDate } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { extractYouTubeVideoId } from "@/lib/youtube";
import type { Comment, Lesson, Material, Module, Profile, Progress, Submission, SubmissionMessage } from "@/types/domain";

export const metadata: Metadata = { title: "Aula" };

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversa?: string | string[] }>;
}) {
  const auth = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const conversaRaw = Array.isArray(query.conversa) ? query.conversa[0] : query.conversa;
  const openConversationId = postgresUuidSchema().safeParse(conversaRaw ?? "").success ? conversaRaw : null;
  const supabase = await createClient();
  const [{ data: lessonData }, { data: materialsData }, { data: commentsData }, { data: progressData }, { data: submissionsData }] = await Promise.all([
    supabase.from("lessons").select("id,module_id,title,content,youtube_url,position,requires_submission,published_at,scheduled_for").eq("id", id).maybeSingle(),
    supabase.from("materials").select("id,lesson_id,name,storage_path,mime_type,size_bytes").eq("lesson_id", id).order("created_at"),
    supabase.from("lesson_comments").select("id,lesson_id,author_id,body,t_seconds,created_at").eq("lesson_id", id).order("created_at"),
    auth.role === "aluno" ? supabase.from("lesson_progress").select("lesson_id,user_id,last_seconds,watched,updated_at").eq("lesson_id", id).eq("user_id", auth.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("submissions").select("id,lesson_id,user_id,storage_path,file_name,mime_type,size_bytes,created_at,updated_at").eq("lesson_id", id).order("updated_at", { ascending: false }),
  ]);
  if (!lessonData) notFound();
  const lesson = lessonData as Lesson;
  const { data: moduleData } = await supabase.from("modules").select("id,course_id,title,position,scheduled_for").eq("id", lesson.module_id).single();
  const comments = (commentsData ?? []) as Comment[];
  const submissions = (submissionsData ?? []) as Submission[];
  const studentIds = [...new Set(submissions.map((item) => item.user_id))];
  const messages = await listSubmissionMessages(supabase, lesson.id, studentIds);
  const authorIds = [...new Set([
    ...comments.map((item) => item.author_id),
    ...submissions.map((item) => item.user_id),
    ...messages.map((item) => item.author_id),
  ])];
  const { data: profilesData } = authorIds.length
    ? await supabase.from("profiles").select("id,display_name,bio,avatar_path").in("id", authorIds)
    : { data: [] };
  const profiles = new Map(((profilesData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const commentsWithProfiles = comments.map((item) => ({ ...item, profiles: profiles.get(item.author_id) ?? null }));
  const submissionsWithProfiles = submissions.map((item) => ({ ...item, profiles: profiles.get(item.user_id) ?? null }));
  const messagesByStudent = new Map<string, SubmissionMessage[]>();
  for (const item of messages) {
    const withProfile = { ...item, profiles: profiles.get(item.author_id) ?? null };
    const list = messagesByStudent.get(item.student_id) ?? [];
    list.push(withProfile);
    messagesByStudent.set(item.student_id, list);
  }
  const progress = progressData as Progress | null;
  const materials = (materialsData ?? []) as Material[];
  const ownSubmission = submissionsWithProfiles.find((item) => item.user_id === auth.id) ?? null;
  const future = isFutureDate(lesson.published_at);
  const videoId = lesson.youtube_url ? extractYouTubeVideoId(lesson.youtube_url) : null;

  return (
    <main className="container page lesson-page">
      <div className="lesson-breadcrumb"><Link href="/">Curso</Link><span aria-hidden="true">/</span><span>{(moduleData as Module | null)?.title ?? "Módulo"}</span></div>
      <div className="page-header lesson-page-header">
        <div><div className="cluster" style={{ marginBottom: ".7rem" }}>{future && auth.isStaff ? <span className="badge warning"><CalendarClock aria-hidden="true" size={13} /> Agendada para {formatDateTimeInSaoPaulo(lesson.published_at)}</span> : null}</div><h1>{lesson.title}</h1><p className="page-description">{(moduleData as Module | null)?.title}</p></div>
        {auth.isStaff ? <Link className="button secondary" href={`/lessons/${lesson.id}/edit`}><Pencil aria-hidden="true" size={17} /> Editar aula</Link> : null}
      </div>

      <LessonExperience
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        videoId={videoId}
        initialSeconds={progress?.last_seconds ?? 0}
        initialWatched={progress?.watched ?? false}
        canTrack={auth.role === "aluno"}
        comments={commentsWithProfiles}
      >
        <div className="lesson-content-grid">
          <article className="lesson-body">
            <section aria-labelledby="about-lesson"><h2 id="about-lesson">Sobre a aula</h2><div className="reading">{lesson.content}</div></section>
            <section aria-labelledby="materials-title"><h2 id="materials-title">Materiais</h2>
              {materials.length === 0 ? <p className="muted">Nenhum material foi anexado a esta aula.</p> : (
                <ul className="download-list">{materials.map((material) => <li key={material.id}><FileText aria-hidden="true" size={19} /><span><strong>{material.name}</strong><small>PDF · {Math.max(1, Math.round(material.size_bytes / 1024))} KB</small></span><Link className="button secondary small" href={`${storageFileUrl("materials", material.storage_path)}?nome=${encodeURIComponent(material.name)}`} target="_blank" rel="noreferrer"><Download aria-hidden="true" size={16} /> Abrir PDF</Link></li>)}</ul>
              )}
            </section>
          </article>

          {lesson.requires_submission ? (
            <aside className="panel submission-panel" aria-labelledby="submission-title">
              <h2 id="submission-title">Entrega</h2>
              {auth.role === "aluno" ? (
                <>
                  <SubmissionForm lessonId={lesson.id} userId={auth.id} submission={ownSubmission} />
                  {ownSubmission ? (
                    <div className="submission-card-actions">
                      <SubmissionConversationDialog
                        lessonId={lesson.id}
                        studentId={auth.id}
                        isStaff={false}
                        studentName={publicDisplayName(ownSubmission.profiles?.display_name, "Você")}
                        fileName={ownSubmission.file_name}
                        fileHref={`${storageFileUrl("submissions", ownSubmission.storage_path)}?nome=${encodeURIComponent(ownSubmission.file_name)}`}
                        messages={messagesByStudent.get(auth.id) ?? []}
                        open={openConversationId === auth.id}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                submissionsWithProfiles.length === 0 ? <p className="muted">Nenhum aluno enviou arquivo para esta aula.</p> : (
                  <ul className="submission-list">{submissionsWithProfiles.map((submission) => {
                    const studentName = publicDisplayName(submission.profiles?.display_name, "Aluno");
                    return (
                      <li key={submission.id}>
                        <div className="submission-card-head">
                          <strong>{studentName}</strong>
                          <span>{submission.file_name}</span>
                        </div>
                        <div className="submission-card-actions">
                          <Link className="button secondary small" href={`${storageFileUrl("submissions", submission.storage_path)}?nome=${encodeURIComponent(submission.file_name)}`} target="_blank" rel="noreferrer">Abrir arquivo</Link>
                          <SubmissionConversationDialog
                            lessonId={lesson.id}
                            studentId={submission.user_id}
                            isStaff
                            studentName={studentName}
                            fileName={submission.file_name}
                            fileHref={`${storageFileUrl("submissions", submission.storage_path)}?nome=${encodeURIComponent(submission.file_name)}`}
                            messages={messagesByStudent.get(submission.user_id) ?? []}
                            open={openConversationId === submission.user_id}
                          />
                        </div>
                      </li>
                    );
                  })}</ul>
                )
              )}
            </aside>
          ) : null}
        </div>
      </LessonExperience>
    </main>
  );
}
