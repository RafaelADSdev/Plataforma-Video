import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { formatScheduleTimeRange, WEEKDAY_LABELS, type IsoWeekday } from "@/lib/schedule";
import { formatRoutineDay, routineDayKey, type RoutineDay } from "@/lib/study-planner";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyScheduleSlot } from "@/types/domain";

const PREVIEW_LIMIT = 3;

type RoutineEntry = { week_number: RoutineDay["week"]; weekday: IsoWeekday; note: string };
type RecommendedSlot = Pick<WeeklyScheduleSlot, "id" | "starts_at" | "ends_at" | "note"> & { weekday: IsoWeekday };

export async function ScheduleSidePanel({ courseId, userId }: { courseId: string; userId: string }) {
  const supabase = await createClient();
  const [routine, recommended] = await Promise.all([
    supabase.from("study_routine_days")
      .select("week_number,weekday,note")
      .eq("course_id", courseId)
      .eq("owner_id", userId)
      .order("week_number")
      .order("weekday")
      .limit(PREVIEW_LIMIT)
      .overrideTypes<RoutineEntry[], { merge: false }>(),
    supabase.from("weekly_schedule_slots")
      .select("id,weekday,starts_at,ends_at,note")
      .eq("course_id", courseId)
      .is("owner_id", null)
      .order("weekday")
      .order("starts_at")
      .limit(PREVIEW_LIMIT)
      .overrideTypes<RecommendedSlot[], { merge: false }>(),
  ]);

  return (
    <section className="panel study-side-panel schedule-preview" aria-labelledby="schedule-preview-title">
      <span className="study-side-icon"><CalendarDays size={21} aria-hidden="true" /></span>
      <h2 id="schedule-preview-title">Cronograma</h2>
      <div className="schedule-preview-group">
        <h3><Link className="inline-link" href="/cronograma">Rotina de estudos <ArrowRight size={16} aria-hidden="true" /></Link></h3>
        {routine.data?.length ? (
          <ul className="schedule-preview-list">
            {routine.data.map(({ week_number, weekday, note }) => {
              const day = { week: week_number, weekday };
              return (
                <li key={routineDayKey(day)}>
                  <strong>{formatRoutineDay(day)}</strong>
                  <span className="schedule-preview-note">{note}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{routine.error ? "Não foi possível carregar sua rotina." : "Você ainda não tem dias planejados."}</p>
        )}
      </div>
      <div className="schedule-preview-group">
        <h3><Link className="inline-link" href="/cronograma?vista=recomendado">Semana recomendada <ArrowRight size={16} aria-hidden="true" /></Link></h3>
        {recommended.data?.length ? (
          <ul className="schedule-preview-list">
            {recommended.data.map((slot) => (
              <li key={slot.id}>
                <strong>{WEEKDAY_LABELS[slot.weekday].full} · {formatScheduleTimeRange(slot.starts_at, slot.ends_at)}</strong>
                {slot.note ? <span className="schedule-preview-note">{slot.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{recommended.error ? "Não foi possível carregar a semana recomendada." : "Ainda não há horários recomendados."}</p>
        )}
      </div>
    </section>
  );
}
