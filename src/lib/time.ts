export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export type DateInput = Date | string | number;
export type ScheduleWeekGroup = "past" | "current" | "upcoming";

export const SCHEDULE_WEEK_LABELS: Record<ScheduleWeekGroup, string> = {
  past: "Semanas passadas",
  current: "Esta semana",
  upcoming: "Próximas semanas",
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const saoPauloPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDate(value: DateInput): Date {
  const dateOnlyMatch =
    typeof value === "string"
      ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
      : null;
  const date = dateOnlyMatch
    ? new Date(
        Date.UTC(
          Number(dateOnlyMatch[1]),
          Number(dateOnlyMatch[2]) - 1,
          Number(dateOnlyMatch[3]),
          // Noon UTC is safely on the same calendar day in São Paulo. Treating
          // a Postgres DATE as UTC midnight would incorrectly move it back a day.
          12,
        ),
      )
    : value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (
    Number.isNaN(date.getTime()) ||
    (dateOnlyMatch !== null &&
      (date.getUTCFullYear() !== Number(dateOnlyMatch[1]) ||
        date.getUTCMonth() + 1 !== Number(dateOnlyMatch[2]) ||
        date.getUTCDate() !== Number(dateOnlyMatch[3])))
  ) {
    throw new RangeError("Data inválida.");
  }

  return date;
}

function getSaoPauloParts(value: DateInput): DateParts {
  const parts = saoPauloPartsFormatter.formatToParts(toDate(value));
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const getPart = (name: keyof DateParts): number => {
    const part = values.get(name);

    if (part === undefined) {
      throw new RangeError("Não foi possível interpretar a data.");
    }

    return part;
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

/**
 * Formats player progress as mm:ss. Minutes intentionally keep growing after
 * one hour (for example, 3661 becomes 61:01), matching the product copy.
 */
export function formatVideoTime(seconds: number): string {
  const safeSeconds =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${pad2(minutes)}:${pad2(remainingSeconds)}`;
}

export function formatDateInSaoPaulo(value: DateInput): string {
  const { year, month, day } = getSaoPauloParts(value);
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

export function formatDateTimeInSaoPaulo(value: DateInput): string {
  const { year, month, day, hour, minute } = getSaoPauloParts(value);
  return `${pad2(day)}/${pad2(month)}/${year} às ${pad2(hour)}:${pad2(minute)}`;
}

/** Value suitable for an HTML datetime-local input, in São Paulo local time. */
export function toSaoPauloDateTimeInput(value: DateInput): string {
  const { year, month, day, hour, minute } = getSaoPauloParts(value);
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

function getTimeZoneOffsetMilliseconds(date: Date): number {
  const parts = getSaoPauloParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  // Intl has second precision; discarding milliseconds avoids a false offset.
  return representedAsUtc - Math.floor(date.getTime() / 1_000) * 1_000;
}

/**
 * Parses an HTML datetime-local value as America/Sao_Paulo. Invalid calendar
 * values (and nonexistent wall-clock times during historical DST changes) are
 * rejected instead of being silently shifted.
 */
export function parseSaoPauloDateTimeInput(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const expected: DateParts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText ?? "0"),
  };
  const localCalendarMilliseconds = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
    expected.second,
  );
  const calendarCheck = new Date(localCalendarMilliseconds);

  if (
    calendarCheck.getUTCFullYear() !== expected.year ||
    calendarCheck.getUTCMonth() + 1 !== expected.month ||
    calendarCheck.getUTCDate() !== expected.day ||
    calendarCheck.getUTCHours() !== expected.hour ||
    calendarCheck.getUTCMinutes() !== expected.minute ||
    calendarCheck.getUTCSeconds() !== expected.second
  ) {
    return null;
  }

  let instantMilliseconds = localCalendarMilliseconds;

  // Re-evaluate the offset because the first guess can fall on the other side
  // of a historical daylight-saving transition.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMilliseconds(new Date(instantMilliseconds));
    instantMilliseconds = localCalendarMilliseconds - offset;
  }

  const result = new Date(instantMilliseconds);
  const actual = getSaoPauloParts(result);

  return Object.keys(expected).every(
    (key) => actual[key as keyof DateParts] === expected[key as keyof DateParts],
  )
    ? result
    : null;
}

export function saoPauloDateTimeInputToIso(value: string): string | null {
  return parseSaoPauloDateTimeInput(value)?.toISOString() ?? null;
}

export function isFutureDate(value: DateInput, reference: DateInput = new Date()): boolean {
  return toDate(value).getTime() > toDate(reference).getTime();
}

function dateKeyFromUtcCalendarDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

/** Returns the local Monday for the supplied instant as YYYY-MM-DD. */
/** ISO weekday in São Paulo: 1 Monday through 7 Sunday. */
export function getIsoWeekdayInSaoPaulo(value: DateInput = new Date()): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const { year, month, day } = getSaoPauloParts(value);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function getWeekStartKeyInSaoPaulo(value: DateInput): string {
  const { year, month, day } = getSaoPauloParts(value);
  const localCalendarDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (localCalendarDate.getUTCDay() + 6) % 7;
  localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() - daysSinceMonday);

  return dateKeyFromUtcCalendarDate(localCalendarDate);
}

export function getWeekOffsetInSaoPaulo(
  value: DateInput,
  reference: DateInput = new Date(),
): number {
  const valueMonday = new Date(`${getWeekStartKeyInSaoPaulo(value)}T00:00:00Z`);
  const referenceMonday = new Date(
    `${getWeekStartKeyInSaoPaulo(reference)}T00:00:00Z`,
  );

  return Math.round(
    (valueMonday.getTime() - referenceMonday.getTime()) /
      (7 * 24 * 60 * 60 * 1_000),
  );
}

export function getScheduleWeekGroup(
  value: DateInput,
  reference: DateInput = new Date(),
): ScheduleWeekGroup {
  const offset = getWeekOffsetInSaoPaulo(value, reference);

  if (offset < 0) {
    return "past";
  }

  return offset === 0 ? "current" : "upcoming";
}
