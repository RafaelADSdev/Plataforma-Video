import type { AuthContext } from "@/lib/auth";

export function canReadSubmissionConversation(auth: AuthContext, studentId: string) {
  return auth.isStaff || auth.id === studentId;
}

export function canWriteSubmissionMessage(auth: AuthContext, studentId: string) {
  return canReadSubmissionConversation(auth, studentId);
}
