import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import { CopyScheduleButton } from "@/components/copy-schedule-button";
import { EmptyState } from "@/components/empty-state";
import { ScheduleSlotForm } from "@/components/schedule-slot-form";
import { ScheduleWeekBoard } from "@/components/schedule-week-board";
import { StudyPlanner } from "@/components/study-planner";
import { requireUser, type AuthContext } from "@/lib/auth";
import { canCopyRecommendedSchedule, canEditPersonalSchedule, canEditRecommendedSchedule } from "@/lib/schedule-permissions";
import { getPlannerWeeks, isPlannerMonth } from "@/lib/study-planner";
import { createClient } from "@/lib/supabase/server";
import { getIsoWeekdayInSaoPaulo, toSaoPauloDateTimeInput } from "@/lib/time";
import type { WeeklyScheduleSlot } from "@/types/domain";
import plannerStyles from "@/components/study-planner.module.css";

export const metadata: Metadata = { title: "Cronograma" };

const plannerFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-planner",
  display: "swap",
  preload: false,
});

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; mes?: string }>;
}) {
  const auth = await requireUser();
  const { vista, mes } = await searchParams;
  const isStudent = auth.role === "aluno";
  const viewingPersonal = isStudent && vista === "meu";
  const viewingPlanner = !viewingPersonal && vista !== "recomendado";
  const supabase = await createClient();
  const { data: course, error } = await supabase.from("courses").select("id").limit(1).maybeSingle();

  return (
    <main className={`container page schedule-page${viewingPlanner ? ` ${plannerStyles.monthPage} ${plannerFont.variable}` : ""}`}>
      <div className="page-header">
        <div>
          <h1>Cronograma</h1>
          <p className="page-description">
            {viewingPlanner
              ? "Organize seus estudos por dia e baixe seu plano do mês."
              : auth.isStaff
                ? "Monte a semana de estudo que os alunos podem consultar e copiar."
                : "Consulte os horários da semana ou organize sua própria rotina."}
          </p>
        </div>
      </div>

      <nav className="schedule-tabs" aria-label="Tipo de cronograma">
        <Link href="/cronograma" aria-current={viewingPlanner ? "page" : undefined}>Planner mensal</Link>
        <Link href="/cronograma?vista=recomendado" aria-current={!viewingPlanner && !viewingPersonal ? "page" : undefined}>Semana recomendada</Link>
        {isStudent ? <Link href="/cronograma?vista=meu" aria-current={viewingPersonal ? "page" : undefined}>Minha semana</Link> : null}
      </nav>

      {error ? (
        <EmptyState title="Não foi possível carregar o cronograma">
          <p>Tente novamente em instantes.</p>
        </EmptyState>
      ) : !course ? (
        <EmptyState title="O curso ainda não foi configurado">
          <p>Quando o curso existir, o cronograma aparece aqui.</p>
        </EmptyState>
      ) : viewingPlanner ? (
        <MonthlySchedule courseId={course.id} ownerId={auth.id} requestedMonth={mes} />
      ) : (
        <WeeklySchedule courseId={course.id} auth={auth} viewingPersonal={viewingPersonal} />
      )}
    </main>
  );
}

async function MonthlySchedule({ courseId, ownerId, requestedMonth }: { courseId: string; ownerId: string; requestedMonth?: string }) {
  const today = toSaoPauloDateTimeInput(new Date()).slice(0, 10);
  const month = typeof requestedMonth === "string" && isPlannerMonth(requestedMonth) ? requestedMonth : today.slice(0, 7);
  const weeks = getPlannerWeeks(month);
  const lastDate = weeks.at(-1)?.dates.findLast((date) => date !== null);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_planner_days")
    .select("study_date,note")
    .eq("course_id", courseId)
    .eq("owner_id", ownerId)
    .gte("study_date", `${month}-01`)
    .lte("study_date", lastDate ?? `${month}-01`);

  if (error) {
    return (
      <EmptyState title="Não foi possível carregar o planner">
        <p>Tente novamente em instantes.</p>
      </EmptyState>
    );
  }

  const notes = Object.fromEntries(data.map(({ study_date, note }) => [study_date, note]));
  return <StudyPlanner key={month} courseId={courseId} month={month} today={today} weeks={weeks} notes={notes} />;
}

async function WeeklySchedule({ courseId, auth, viewingPersonal }: { courseId: string; auth: AuthContext; viewingPersonal: boolean }) {
  const supabase = await createClient();
  const recommendedQuery = supabase.from("weekly_schedule_slots").select("id,course_id,owner_id,weekday,starts_at,ends_at,note,created_at").eq("course_id", courseId).is("owner_id", null).order("weekday").order("starts_at");
  const personalQuery =
    viewingPersonal
      ? supabase.from("weekly_schedule_slots").select("id,course_id,owner_id,weekday,starts_at,ends_at,note,created_at").eq("course_id", courseId).eq("owner_id", auth.id).order("weekday").order("starts_at")
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

  if (loadError) {
    return (
      <EmptyState title="Não foi possível carregar o cronograma">
        <p>Tente novamente em instantes.</p>
      </EmptyState>
    );
  }

  return (
    <div className={canEdit ? "schedule-layout" : undefined}>
      <div className="schedule-main">
        {auth.role === "aluno" && !viewingPersonal ? (
          <p className="muted schedule-view-hint">Confira os horários de estudo sugeridos pelo professor.</p>
        ) : null}
        {viewingPersonal ? (
          <div className="schedule-personal-toolbar">
            <p className="muted">Este cronograma é só seu. Copiar o do professor substitui os horários atuais.</p>
            {canCopyRecommendedSchedule(auth) && recommended.length > 0 ? (
              <CopyScheduleButton courseId={courseId} hasPersonalSlots={personal.length > 0} />
            ) : null}
          </div>
        ) : null}
        {slots.length === 0 ? (
          <EmptyState title={viewingPersonal ? "Você ainda não tem horários na semana" : "O cronograma recomendado está vazio"}>
            <p>
              {viewingPersonal
                ? recommended.length > 0
                  ? "Copie o cronograma do professor ou adicione um horário."
                  : "Adicione um horário para começar."
                : auth.isStaff
                  ? "Adicione um dia, um horário e, se quiser, uma observação."
                  : "Quando o professor definir a semana de estudo, ela aparece aqui."}
            </p>
          </EmptyState>
        ) : (
          <ScheduleWeekBoard slots={slots} todayWeekday={todayWeekday} canEdit={canEdit} />
        )}
      </div>
      {canEdit ? (
        <aside className="panel schedule-editor" aria-labelledby="add-slot-title">
          <h2 id="add-slot-title">{viewingPersonal ? "Novo horário" : "Novo horário recomendado"}</h2>
          <p className="muted">
            {viewingPersonal
              ? "Vale para toda semana, no horário de Brasília."
              : "Os alunos veem esta recomendação e podem copiá-la."}
          </p>
          <ScheduleSlotForm courseId={courseId} defaultWeekday={todayWeekday} />
        </aside>
      ) : null}
    </div>
  );
}
