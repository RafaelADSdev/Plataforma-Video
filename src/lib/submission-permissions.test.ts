import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/auth";
import { canReadSubmissionConversation, canWriteSubmissionMessage } from "./submission-permissions";

function auth(role: AuthContext["role"], id = "aluno-1"): AuthContext {
  return {
    id,
    email: "pessoa@example.com",
    role,
    isStaff: role === "admin" || role === "professor",
    isAdmin: role === "admin",
  };
}

describe("permissões da conversa da entrega", () => {
  it("aluno lê e escreve só a própria conversa", () => {
    const student = auth("aluno", "aluno-1");
    expect(canReadSubmissionConversation(student, "aluno-1")).toBe(true);
    expect(canWriteSubmissionMessage(student, "aluno-1")).toBe(true);
    expect(canReadSubmissionConversation(student, "outro")).toBe(false);
    expect(canWriteSubmissionMessage(student, "outro")).toBe(false);
  });

  it("professor e admin leem e respondem qualquer conversa da aula", () => {
    const professor = auth("professor", "prof-1");
    const admin = auth("admin", "admin-1");
    expect(canReadSubmissionConversation(professor, "aluno-1")).toBe(true);
    expect(canWriteSubmissionMessage(professor, "aluno-1")).toBe(true);
    expect(canReadSubmissionConversation(admin, "aluno-1")).toBe(true);
    expect(canWriteSubmissionMessage(admin, "aluno-1")).toBe(true);
  });
});
