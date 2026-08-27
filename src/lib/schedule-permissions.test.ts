import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/auth";
import { canCopyRecommendedSchedule, canEditPersonalSchedule, canEditRecommendedSchedule } from "./schedule-permissions";

function auth(role: AuthContext["role"], id = "user-1"): AuthContext {
  return {
    id,
    email: "pessoa@example.com",
    role,
    isStaff: role === "admin" || role === "professor",
    isAdmin: role === "admin",
  };
}

describe("permissões do cronograma", () => {
  it("professor e admin editam só o recomendado", () => {
    expect(canEditRecommendedSchedule(auth("professor"))).toBe(true);
    expect(canEditRecommendedSchedule(auth("admin"))).toBe(true);
    expect(canEditPersonalSchedule(auth("professor"))).toBe(false);
    expect(canCopyRecommendedSchedule(auth("professor"))).toBe(false);
  });

  it("aluno edita o próprio e pode copiar o recomendado", () => {
    const student = auth("aluno");
    expect(canEditRecommendedSchedule(student)).toBe(false);
    expect(canEditPersonalSchedule(student)).toBe(true);
    expect(canCopyRecommendedSchedule(student)).toBe(true);
  });
});
