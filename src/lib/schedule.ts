import type { WeeklyScheduleSlot } from "@/types/domain";

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<IsoWeekday, { short: string; full: string }> = {
  1: { short: "Seg", full: "Segunda-feira" },
  2: { short: "Ter", full: "Terça-feira" },
  3: { short: "Qua", full: "Quarta-feira" },
  4: { short: "Qui", full: "Quinta-feira" },
  5: { short: "Sex", full: "Sexta-feira" },
  6: { short: "Sáb", full: "Sábado" },
  7: { short: "Dom", full: "Domingo" },
};

export const MAX_WEEKLY_SCHEDULE_SLOTS = 28;
export const MAX_SCHEDULE_NOTE_LENGTH = 280;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/;

export function isIsoWeekday(value: number): value is IsoWeekday {
  return WEEKDAYS.includes(value as IsoWeekday);
}

export function parseScheduleTimeInput(value: string): string | null {
  const match = value.trim().match(TIME_PATTERN);
  if (!match) return null;
  return `${match[1]}:${match[2]}:00`;
}

export function formatScheduleTime(value: string): string {
  const parsed = parseScheduleTimeInput(value);
  return parsed ? parsed.slice(0, 5) : value;
}

export function formatScheduleTimeRange(startsAt: string, endsAt: string | null): string {
  const start = formatScheduleTime(startsAt);
  if (!endsAt) return start;
  return `${start}–${formatScheduleTime(endsAt)}`;
}

export function toTimeInputValue(value: string): string {
  return formatScheduleTime(value);
}

export function isScheduleTimeRangeValid(startsAt: string, endsAt: string | null): boolean {
  if (!endsAt) return true;
  return endsAt > startsAt;
}

export function groupSlotsByWeekday(slots: WeeklyScheduleSlot[]): Map<IsoWeekday, WeeklyScheduleSlot[]> {
  const grouped = new Map<IsoWeekday, WeeklyScheduleSlot[]>(
    WEEKDAYS.map((day) => [day, [] as WeeklyScheduleSlot[]]),
  );
  for (const slot of slots) {
    if (!isIsoWeekday(slot.weekday)) continue;
    grouped.get(slot.weekday)?.push(slot);
  }
  for (const day of WEEKDAYS) {
    grouped.get(day)?.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.created_at.localeCompare(b.created_at));
  }
  return grouped;
}
