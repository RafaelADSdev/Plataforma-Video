import type { AuthContext } from "@/lib/auth";

export function canEditRecommendedSchedule(auth: AuthContext) {
  return auth.isStaff;
}

export function canEditPersonalSchedule(auth: AuthContext) {
  return auth.role === "aluno";
}

export function canCopyRecommendedSchedule(auth: AuthContext) {
  return auth.role === "aluno";
}
