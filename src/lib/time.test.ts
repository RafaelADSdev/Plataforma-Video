import { describe, expect, it } from "vitest";

import {
  formatDateInSaoPaulo,
  formatDateTimeInSaoPaulo,
  formatVideoTime,
  getIsoWeekdayInSaoPaulo,
  getScheduleWeekGroup,
  getWeekOffsetInSaoPaulo,
  getWeekStartKeyInSaoPaulo,
  parseSaoPauloDateTimeInput,
  saoPauloDateTimeInputToIso,
  toSaoPauloDateTimeInput,
} from "./time";

describe("formatVideoTime", () => {
  it.each([
    [0, "00:00"],
    [-1, "00:00"],
    [Number.NaN, "00:00"],
    [75.9, "01:15"],
    [3_661, "61:01"],
  ])("formata %s como %s", (seconds, expected) => {
    expect(formatVideoTime(seconds)).toBe(expected);
  });
});

describe("datas em America/Sao_Paulo", () => {
  it("formata uma data no dia local correto", () => {
    const instant = "2026-08-24T02:30:00.000Z";
    expect(formatDateInSaoPaulo(instant)).toBe("23/08/2026");
    expect(formatDateTimeInSaoPaulo(instant)).toBe(
      "23/08/2026 às 23:30",
    );
    expect(toSaoPauloDateTimeInput(instant)).toBe("2026-08-23T23:30");
    // Postgres DATE deve representar um dia civil, não meia-noite UTC.
    expect(formatDateInSaoPaulo("2026-08-24")).toBe("24/08/2026");
  });

  it("converte datetime-local de São Paulo em instante UTC", () => {
    expect(saoPauloDateTimeInputToIso("2026-08-26T10:00")).toBe(
      "2026-08-26T13:00:00.000Z",
    );
    expect(parseSaoPauloDateTimeInput("2026-02-30T10:00")).toBeNull();
    expect(parseSaoPauloDateTimeInput("26/08/2026 10:00")).toBeNull();
  });
});

describe("semanas em America/Sao_Paulo", () => {
  const reference = "2026-08-26T15:00:00.000Z";

  it("calcula o dia da semana ISO no fuso de São Paulo", () => {
    expect(getIsoWeekdayInSaoPaulo("2026-08-24T02:30:00.000Z")).toBe(7);
    expect(getIsoWeekdayInSaoPaulo("2026-08-24T03:00:00.000Z")).toBe(1);
    expect(getIsoWeekdayInSaoPaulo("2026-08-24")).toBe(1);
  });

  it("considera a segunda-feira local na virada da semana", () => {
    // Já é segunda-feira em UTC, mas ainda é domingo em São Paulo.
    expect(getWeekStartKeyInSaoPaulo("2026-08-24T02:30:00.000Z")).toBe(
      "2026-08-17",
    );
    expect(getWeekStartKeyInSaoPaulo("2026-08-24T03:00:00.000Z")).toBe(
      "2026-08-24",
    );
    expect(getWeekStartKeyInSaoPaulo("2026-08-24")).toBe("2026-08-24");
  });

  it("calcula o deslocamento e os grupos do cronograma", () => {
    expect(getWeekOffsetInSaoPaulo("2026-08-20T12:00:00Z", reference)).toBe(
      -1,
    );
    expect(getScheduleWeekGroup("2026-08-20T12:00:00Z", reference)).toBe(
      "past",
    );
    expect(getScheduleWeekGroup("2026-08-29T12:00:00Z", reference)).toBe(
      "current",
    );
    expect(getScheduleWeekGroup("2026-09-01T12:00:00Z", reference)).toBe(
      "upcoming",
    );
  });
});
