import { describe, expect, it } from "vitest";
import {
  formatScheduleTime,
  formatScheduleTimeRange,
  groupSlotsByWeekday,
  isScheduleTimeRangeValid,
  parseScheduleTimeInput,
} from "./schedule";
import type { WeeklyScheduleSlot } from "@/types/domain";

describe("horários do cronograma", () => {
  it("normaliza entrada de hora para HH:MM:SS", () => {
    expect(parseScheduleTimeInput("19:00")).toBe("19:00:00");
    expect(parseScheduleTimeInput("07:05:00")).toBe("07:05:00");
    expect(parseScheduleTimeInput("24:00")).toBeNull();
    expect(parseScheduleTimeInput("19h00")).toBeNull();
  });

  it("formata faixa de horário", () => {
    expect(formatScheduleTime("19:00:00")).toBe("19:00");
    expect(formatScheduleTimeRange("19:00:00", null)).toBe("19:00");
    expect(formatScheduleTimeRange("19:00:00", "20:30:00")).toBe("19:00–20:30");
  });

  it("recusa término igual ou anterior ao início", () => {
    expect(isScheduleTimeRangeValid("19:00:00", null)).toBe(true);
    expect(isScheduleTimeRangeValid("19:00:00", "20:00:00")).toBe(true);
    expect(isScheduleTimeRangeValid("19:00:00", "19:00:00")).toBe(false);
    expect(isScheduleTimeRangeValid("19:00:00", "18:00:00")).toBe(false);
  });

  it("agrupa slots por dia ISO e ordena pela hora", () => {
    const slots: WeeklyScheduleSlot[] = [
      {
        id: "b",
        course_id: "c1",
        owner_id: null,
        weekday: 1,
        starts_at: "20:00:00",
        ends_at: null,
        note: "noite",
        created_at: "2026-08-27T00:00:00.000Z",
      },
      {
        id: "a",
        course_id: "c1",
        owner_id: null,
        weekday: 1,
        starts_at: "08:00:00",
        ends_at: "09:00:00",
        note: "manhã",
        created_at: "2026-08-27T00:00:00.000Z",
      },
      {
        id: "c",
        course_id: "c1",
        owner_id: null,
        weekday: 5,
        starts_at: "14:00:00",
        ends_at: null,
        note: "",
        created_at: "2026-08-27T00:00:00.000Z",
      },
    ];
    const grouped = groupSlotsByWeekday(slots);
    expect(grouped.get(1)?.map((slot) => slot.id)).toEqual(["a", "b"]);
    expect(grouped.get(5)).toHaveLength(1);
    expect(grouped.get(2)).toEqual([]);
  });
});
