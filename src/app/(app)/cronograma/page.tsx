import type { Metadata } from "next";
import Link from "next/link";
import { CopyScheduleButton } from "@/components/copy-schedule-button";
import { EmptyState } from "@/components/empty-state";
import { ScheduleSlotForm } from "@/components/schedule-slot-form";
import { ScheduleWeekBoard } from "@/components/schedule-week-board";
import { requireUser } from "@/lib/auth";
import { canCopyRecommendedSchedule, canEditPersonalSchedule, canEditRecommendedSchedule } from "@/lib/schedule-permissions";
import { createClient } from "@/lib/supabase/server";
import { getIsoWeekdayInSaoPaulo } from "@/lib/time";
import type { Course, WeeklyScheduleSlot } from "@/types/domain";

export const metadata: Metadata = { title: "Cronograma" };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const auth = await requireUser();
  const { vista } = await searchParams;
  const viewingPersonal = auth.role === "aluno" && vista === "meu";
  const supabase = await createClient();
  const { data: courseData } = await supabase.from("courses").select("id,title,description,cover_path").limit(1).maybeSingle();
  const course = courseData as Course | null;

  const recommendedQuery = course
    ? supabase.from("weekly_schedule_slots").select("id,course_id,owner_id,weekday,starts_at,ends_at,note,created_at").eq("course_id", course.id).is("owner_id", null).order("weekday").order("starts_at")
    : Promise.resolve({ data: [] as WeeklyScheduleSlot[], error: null });
  const personalQuery =
    course && auth.role === "aluno"
      ? supabase.from("weekly_schedule_slots").select("id,course_id,owner_id,weekday,starts_at,ends_at,note,created_at").eq("course_id", course.id).eq("owner_id", auth.id).order("weekday").order("starts_at")
      : Promise.resolve({ data: [] as WeeklyScheduleSlot[], error: null });

  const [{ data: recommendedData, error: recommendedError }, { data: personalData, error: personalError }] = await Promise.all([
    recommendedQuery,
    personalQuery,
  ]);

  const recommended = (recommendedData ?? []) as WeeklyScheduleSlot[];
  const personal = (personalData ?? []) as WeeklyScheduleSlot[];
  const slots = viewingPersonal ? personal : recommended;
  const canEdit = viewingPersonal ? canEditPersonalSchedule(auth) : canEditRecommendedSchedule(auth);
  const todayWeekday = getIsoWeekdayInSaoPaulo();
  const loadError = recommendedError || personalError;

  return (
    <main className="container page schedule-page">
      <div className="page-header">
        <div>
          <h1>Cronograma</h1>
          <p className="page-description">
            {auth.isStaff
              ? "Monte a semana recomendada de estudo, com horário e observação. Os alunos podem seguir, copiar ou criar a própria."
              : "Veja a semana que o professor recomenda, copie para o seu cronograma ou monte a sua."}
          </p>
        </div>
      </div>

      {auth.role === "aluno" ? (
        <nav className="schedule-tabs" aria-label="Tipo de cronograma">
          <Link href="/cronograma" aria-current={viewingPersonal ? undefined : "page"}>Recomendado</Link>
          <Link href="/cronograma?vista=meu" aria-current={viewingPersonal ? "page" : undefined}>Meu cronograma</Link>
        </nav>
      ) : null}

      {!course ? (
        <EmptyState title="O curso ainda não foi configurado">
          <p>Quando o curso existir, o cronograma aparece aqui.</p>
        </EmptyState>
      ) : loadError ? (
        <EmptyState title="Não foi possível carregar o cronograma">
          <p>Tente novamente em instantes.</p>
        </EmptyState>
      ) : (
        <div className={canEdit ? "schedule-layout" : undefined}>
          <div className="schedule-main">
            {auth.role === "aluno" && !viewingPersonal ? (
              <p className="muted schedule-view-hint">Este é o cronograma recomendado pelo professor. Ele não muda o seu.</p>
            ) : null}
            {auth.role === "aluno" && viewingPersonal ? (
              <div className="schedule-personal-toolbar">
                <p className="muted">Este cronograma é só seu. Copiar o do professor substitui os horários atuais.</p>
                {canCopyRecommendedSchedule(auth) && recommended.length > 0 ? (
                  <CopyScheduleButton courseId={course.id} hasPersonalSlots={personal.length > 0} />
                ) : null}
              </div>
            ) : null}
            {slots.length === 0 ? (
              <EmptyState
                title={
                  viewingPersonal
                    ? "Você ainda não tem um cronograma"
                    : "O cronograma recomendado está vazio"
                }
              >
                <p>
                  {viewingPersonal
                    ? recommended.length > 0
                      ? "Copie o cronograma do professor ou adicione horários no formulário."
                      : "Adicione horários no formulário. Quando o professor publicar a semana recomendada, você também poderá copiá-la."
                    : auth.isStaff
                      ? "Adicione um dia, um horário e, se quiser, uma observação."
                      : "Quando o professor definir a semana de estudo, ela aparece aqui."}
                </p>
              </EmptyState>
            ) : (
              <ScheduleWeekBoard slots={slots} todayWeekday={todayWeekday} canEdit={canEdit} />
            )}
          </div>
          {canEdit && course ? (
            <aside className="panel schedule-editor" aria-labelledby="add-slot-title">
              <h2 id="add-slot-title">{viewingPersonal ? "Novo horário" : "Novo horário recomendado"}</h2>
              <p className="muted">
                {viewingPersonal
                  ? "Vale para toda semana, no horário de Brasília."
                  : "Os alunos veem esta recomendação e podem copiá-la."}
              </p>
              <ScheduleSlotForm courseId={course.id} defaultWeekday={todayWeekday} />
            </aside>
          ) : null}
        </div>
      )}
    </main>
  );
}
