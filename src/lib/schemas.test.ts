import { describe, expect, it } from "vitest";
import { postgresUuidSchema } from "@/lib/schemas";

describe("postgresUuidSchema", () => {
  it("aceita o identificador canônico do curso inicial", () => {
    expect(
      postgresUuidSchema().safeParse("00000000-0000-0000-0000-000000000001").success,
    ).toBe(true);
  });

  it("aceita UUID v4 gerado pelo banco", () => {
    expect(
      postgresUuidSchema().safeParse("e2445560-15be-4f88-8d89-4ca5544fdd82").success,
    ).toBe(true);
  });

  it("recusa texto que não tem o formato UUID do Postgres", () => {
    expect(postgresUuidSchema().safeParse("curso-1").success).toBe(false);
  });
});
