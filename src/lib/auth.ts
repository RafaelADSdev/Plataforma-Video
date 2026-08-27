import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "professor" | "aluno";

export type AuthContext = {
  id: string;
  email: string;
  role: Role;
  isStaff: boolean;
  isAdmin: boolean;
};

function parseRole(value: unknown): Role | null {
  if (value === "admin" || value === "professor" || value === "aluno") return value;
  return null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const metadata = data.claims.app_metadata;
  const role = parseRole(
    metadata && typeof metadata === "object" && "role" in metadata
      ? metadata.role
      : undefined,
  );
  if (!role) return null;

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    role,
    isStaff: role === "admin" || role === "professor",
    isAdmin: role === "admin",
  };
}

export async function requireUser() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  return auth;
}

export async function requireProfessor() {
  const auth = await requireUser();
  if (!auth.isStaff) redirect("/");
  return auth;
}

export async function requireAdmin() {
  const auth = await requireUser();
  if (!auth.isAdmin) redirect("/");
  return auth;
}
