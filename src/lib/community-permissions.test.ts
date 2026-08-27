import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/auth";
import { canDeleteCommunityPost, canEditCommunityPost } from "./community-permissions";

function auth(role: AuthContext["role"], id = "aluno-1"): AuthContext {
  return {
    id,
    email: "pessoa@example.com",
    role,
    isStaff: role === "admin" || role === "professor",
    isAdmin: role === "admin",
  };
}

describe("permissões da comunidade", () => {
  it("aluno edita e exclui só o próprio post", () => {
    const student = auth("aluno", "aluno-1");
    expect(canEditCommunityPost(student, "aluno-1")).toBe(true);
    expect(canDeleteCommunityPost(student, "aluno-1")).toBe(true);
    expect(canEditCommunityPost(student, "outro")).toBe(false);
    expect(canDeleteCommunityPost(student, "outro")).toBe(false);
  });

  it("professor e admin excluem qualquer post, mas só editam o próprio texto", () => {
    const professor = auth("professor", "prof-1");
    const admin = auth("admin", "admin-1");
    expect(canDeleteCommunityPost(professor, "aluno-1")).toBe(true);
    expect(canDeleteCommunityPost(admin, "aluno-1")).toBe(true);
    expect(canEditCommunityPost(professor, "aluno-1")).toBe(false);
    expect(canEditCommunityPost(admin, "aluno-1")).toBe(false);
    expect(canEditCommunityPost(professor, "prof-1")).toBe(true);
    expect(canEditCommunityPost(admin, "admin-1")).toBe(true);
  });
});
