import { describe, expect, it } from "vitest";
import {
  formDisplayName,
  isUsableDisplayName,
  publicDisplayName,
} from "@/lib/profile-name";

describe("nome de exibição", () => {
  it("recusa e-mail no lugar do nome", () => {
    expect(isUsableDisplayName("testealuno@gmail.com", "testealuno@gmail.com")).toBe(false);
    expect(formDisplayName("testealuno@gmail.com", "testealuno@gmail.com")).toBe("");
    expect(publicDisplayName("testealuno@gmail.com")).toBe("Participante");
  });

  it("aceita um nome real", () => {
    expect(isUsableDisplayName("Maria Silva", "testealuno@gmail.com")).toBe(true);
    expect(formDisplayName("Maria Silva", "testealuno@gmail.com")).toBe("Maria Silva");
    expect(publicDisplayName("Maria Silva")).toBe("Maria Silva");
  });

  it("usa o fallback quando o nome ainda não foi definido", () => {
    expect(publicDisplayName(null, "Aluno")).toBe("Aluno");
    expect(formDisplayName(null, "testealuno@gmail.com")).toBe("");
  });
});
