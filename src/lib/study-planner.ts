export const MAX_STUDY_PLAN_LENGTH = 280;

export type StudyPlan = Record<string, string>;
export type PlannerWeek = { number: number; dates: (string | null)[] };

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function isPlannerMonth(value: string): boolean {
  return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
}

export function formatPlannerMonth(month: string): string {
  const label = monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
  return label[0].toUpperCase() + label.slice(1);
}

export function formatPlannerDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function shiftPlannerMonth(month: string, step: number): string | null {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + step);
  const shifted = date.toISOString().slice(0, 7);
  return isPlannerMonth(shifted) ? shifted : null;
}

export function getPlannerWeeks(month: string): PlannerWeek[] {
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = last.getUTCDate();

  return Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => ({
    number: week + 1,
    dates: Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - offset + 1;
      return day >= 1 && day <= days ? `${month}-${String(day).padStart(2, "0")}` : null;
    }),
  }));
}
