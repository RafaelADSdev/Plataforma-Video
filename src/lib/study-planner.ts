import { WEEKDAY_LABELS, type IsoWeekday } from "./schedule";

export const MAX_STUDY_PLAN_LENGTH = 280;
export const ROUTINE_WEEKS = [1, 2, 3, 4] as const;

export type RoutineWeek = (typeof ROUTINE_WEEKS)[number];
export type RoutineDay = { week: RoutineWeek; weekday: IsoWeekday };
export type StudyPlan = Partial<Record<`${RoutineWeek}-${IsoWeekday}`, string>>;

export function routineDayKey({ week, weekday }: RoutineDay): `${RoutineWeek}-${IsoWeekday}` {
  return `${week}-${weekday}`;
}

export function formatRoutineDay({ week, weekday }: RoutineDay): string {
  return `Semana ${week} · ${WEEKDAY_LABELS[weekday].full}`;
}
