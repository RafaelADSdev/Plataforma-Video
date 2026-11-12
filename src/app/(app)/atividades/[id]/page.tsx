import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock3, Download, FileText, Pencil } from "lucide-react";
import { ActivityIcon } from "@/components/activity-list";
import { QuizForm } from "@/components/quiz-form";
import { SubmissionConversationDialog } from "@/components/submission-conversation";
import { SubmissionForm } from "@/components/submission-form";
import { activityColumns, activityKindLabel, activityPublication, quizAttemptColumns } from "@/lib/activities";
import { requireUser, type AuthContext } from "@/lib/auth";
import { publicDisplayName } from "@/lib/profile-name";
import { postgresUuidSchema } from "@/lib/schemas";
import { storageFileUrl } from "@/lib/storage";
import { listSubmissionMessages } from "@/lib/submission-messages";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeInSaoPaulo, isFutureDate } from "@/lib/time";
import type { Activity, ActivityQuiz, Profile, QuizAttempt, Submission, SubmissionMessage } from "@/types/domain";

export const metadata: Metadata = { title: "Atividade" };

function FileStatus({ submission, dueAt }: { submission: Submission; dueAt: string | null }) {
  const late = dueAt && Date.parse(submission.updated_at) > Date.parse(dueAt);
  return <span className={`badge ${late ? "warning" : "success"}`}>{late ? "Enviada com atraso" : "Enviada"}</span>;
}

async function FileResponses({ activity, auth, conversationId }: { activity: Activity; auth: AuthContext; conversationId?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("submissions")
    .select("id,activity_id,user_id,storage_path,file_name,mime_type,size_bytes,created_at,updated_at")
    .eq("activity_id", activity.id).order("updated_at", { ascending: false });
  if (error) throw new Error("Não foi possível consultar as entregas.");
  const submissions = (data ?? []) as Submission[];
  const messages = await listSubmissionMessages(supabase, activity.id, submissions, activity.id === activity.lesson_id);
  const profileIds = [...new Set([...submissions.map((item) => item.user_id), ...messages.map((item) => item.author_id)])];
  const { data: profileData } = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_path").in("id", profileIds)
    : { data: [] };
  const profiles = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const byStudent = new Map<string, SubmissionMessage[]>();
  for (const item of messages) {
    const withProfile = { ...item, profiles: profiles.get(item.author_id) ?? null };
    const existing = byStudent.get(item.student_id);
    if (existing) existing.push(withProfile);
    else byStudent.set(item.student_id, [withProfile]);
  }

  const fileUrl = (submission: Submission) => `${storageFileUrl("submissions", submission.storage_path)}?nome=${encodeURIComponent(submission.file_name)}`;
  const conversation = (submission: Submission) => (
    <SubmissionConversationDialog
      activityId={activity.id} userId={auth.id} studentId={submission.user_id} isStaff={auth.isStaff}
      studentName={publicDisplayName(profiles.get(submission.user_id)?.display_name, auth.isStaff ? "Aluno" : "Você")}
      fileName={submission.file_name} fileHref={fileUrl(submission)}
      messages={byStudent.get(submission.user_id) ?? []} open={conversationId === submission.user_id}
    />
  );
  const own = submissions.find((item) => item.user_id === auth.id) ?? null;
  return (
    <section className="panel activity-detail-panel" aria-labelledby="respostas">
      <div className="section-heading"><h2 id="respostas">{auth.isStaff ? "Entregas dos alunos" : "Sua entrega"}</h2>
        {auth.isStaff ? <span className="badge">{submissions.length}</span> : own ? <FileStatus submission={own} dueAt={activity.due_at} /> : null}
      </div>
      {auth.isStaff ? submissions.length ? (
        <ul className="submission-list">{submissions.map((submission) => (
          <li key={submission.id}>
            <div className="submission-card-head"><strong>{publicDisplayName(profiles.get(submission.user_id)?.display_name, "Aluno")}</strong><span>{submission.file_name}</span></div>
            <div className="cluster"><FileStatus submission={submission} dueAt={activity.due_at} /><time className="meta" dateTime={submission.updated_at}>{formatDateTimeInSaoPaulo(submission.updated_at)}</time></div>
            <div className="submission-card-actions">
              <Link className="button secondary small" href={fileUrl(submission)} target="_blank" rel="noreferrer">Abrir arquivo</Link>
              {conversation(submission)}
            </div>
          </li>
        ))}</ul>
      ) : <p className="muted">Ainda não há entregas para esta atividade.</p> : (
        <div className="stack">
          <SubmissionForm activityId={activity.id} userId={auth.id} submission={own} />
          {own ? <div>{conversation(own)}</div> : null}
        </div>
      )}
    </section>
  );
}

async function QuizResponses({ activity, auth }: { activity: Activity; auth: AuthContext }) {
  const supabase = await createClient();
  const [quizResult, attemptsResult] = await Promise.all([
    supabase.rpc("read_activity_quiz", { p_activity_id: activity.id }),
    supabase.from("quiz_attempts").select(quizAttemptColumns).eq("activity_id", activity.id).order("created_at", { ascending: false }),
  ]);
  if (quizResult.error || !quizResult.data || attemptsResult.error) throw new Error("Não foi possível carregar o questionário.");
  const quiz = quizResult.data as ActivityQuiz;
  const attempts = (attemptsResult.data ?? []) as QuizAttempt[];
  const ids = auth.isStaff ? [...new Set(attempts.map((attempt) => attempt.user_id))] : [];
  const { data: profileData } = ids.length ? await supabase.from("profiles").select("id,display_name").in("id", ids) : { data: [] };
  const names = new Map((profileData ?? []).map((profile) => [profile.id, publicDisplayName(profile.display_name, "Aluno")]));

  return (
    <>
      {!auth.isStaff ? (
        <section className="panel activity-detail-panel" aria-labelledby="questoes">
          <h2 id="questoes">Questões</h2>
          <p className="muted">{quiz.allowRetries ? "Você pode responder novamente após o envio." : "Você tem uma tentativa."}</p>
          <QuizForm activityId={activity.id} quiz={quiz} />
        </section>
      ) : null}
      <section className="panel activity-detail-panel" aria-labelledby="respostas">
        <h2 id="respostas">{auth.isStaff ? "Respostas dos alunos" : "Suas tentativas"}</h2>
        {attempts.length === 0 ? <p className="muted">{auth.isStaff ? "Nenhum aluno respondeu ainda." : "O resultado aparece aqui após o envio."}</p> : (
          <ul className="attempt-list">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <details className="attempt-item">
                  <summary>
                    <span><strong>{auth.isStaff ? `${names.get(attempt.user_id) ?? "Aluno"} · ` : ""}Tentativa {attempt.attempt_number}</strong>
                      <time dateTime={attempt.created_at}>{formatDateTimeInSaoPaulo(attempt.created_at)}{activity.due_at && Date.parse(attempt.created_at) > Date.parse(activity.due_at) ? " · Enviada com atraso" : ""}</time>
                    </span>
                    <span className="badge primary">{attempt.correct_count}/{attempt.question_count} acertos</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </summary>
                  <ol className="attempt-review">
                    {quiz.questions.map((question) => {
                      const selected = question.options.find((option) => option.id === attempt.answers[question.id]);
                      const correct = question.options.find((option) => option.id === question.correctOptionId);
                      return <li key={question.id}><strong>{question.prompt}</strong><span>Resposta: {selected?.text}</span>
                        {correct ? <span className={correct.id === selected?.id ? "review-correct" : "review-incorrect"}>Gabarito: {correct.text}</span> : null}
                      </li>;
                    })}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function ActivityPage({
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
  const { data, error } = await supabase.from("activities").select(activityColumns).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a atividade.");
  if (!data) notFound();
  const activity = data as Activity;
  const [module, lesson] = await Promise.all([
    supabase.from("modules").select("title").eq("id", activity.module_id).maybeSingle(),
    activity.lesson_id ? supabase.from("lessons").select("title").eq("id", activity.lesson_id).maybeSingle() : { data: null },
  ]);
  const publication = activityPublication(activity.published_at);
  const due = activity.due_at;

  return (
    <main className="container page activity-detail">
      <nav className="lesson-breadcrumb" aria-label="Localização"><Link href="/atividades">Atividades</Link><span aria-hidden="true">/</span><span>{module.data?.title}</span></nav>
      <header className="page-header">
        <div>
          <p className="content-type"><ActivityIcon kind={activity.kind} />{activityKindLabel(activity.kind)}</p>
          <h1>{activity.title}</h1>
          <div className="cluster">
            {auth.isStaff ? <span className={`badge ${publication.tone}`}>{publication.label}</span> : null}
            {due ? <span className={`badge ${isFutureDate(due) ? "" : "warning"}`}><Clock3 size={14} aria-hidden="true" /> Prazo {formatDateTimeInSaoPaulo(due)}</span> : null}
          </div>
        </div>
        {auth.isStaff ? <Link href={`/atividades/${id}/editar`} className="button secondary"><Pencil size={17} aria-hidden="true" /> Editar atividade</Link> : null}
      </header>
      <div className="activity-detail-grid">
        <section className="panel activity-detail-panel" aria-labelledby="instrucoes">
          <h2 id="instrucoes">Instruções</h2>
          {activity.instructions ? <p className="reading">{activity.instructions}</p> : null}
          {activity.lesson_id && lesson.data ? <p><Link href={`/lessons/${activity.lesson_id}`}>{lesson.data.title}</Link></p> : null}
          {!activity.instructions && !activity.lesson_id ? <p className="muted">Nenhuma instrução adicional.</p> : null}
          {activity.support_path ? (
            <Link className="activity-attachment" href={`${storageFileUrl("activity-materials", activity.support_path)}?nome=${encodeURIComponent(activity.support_name ?? "apoio.pdf")}`} target="_blank" rel="noreferrer">
              <FileText size={21} aria-hidden="true" /><span>{activity.support_name}<small>PDF de apoio</small></span><Download size={18} aria-hidden="true" />
            </Link>
          ) : null}
        </section>
        {activity.kind === "file" ? <FileResponses activity={activity} auth={auth} conversationId={conversa} /> : <QuizResponses activity={activity} auth={auth} />}
      </div>
    </main>
  );
}
