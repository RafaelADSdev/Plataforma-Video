"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Digite o e-mail.").pipe(z.email("Digite um e-mail válido.")),
  password: z.string().min(1, "Digite a senha."),
});

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const parsed = loginSchema.safeParse({ email, password });
  const values = { email };

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const fieldErrors: Record<string, string> = {};
    if (fields.email?.[0]) fieldErrors.email = fields.email[0];
    if (fields.password?.[0]) fieldErrors.password = fields.password[0];
    return actionError("", fieldErrors, values);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return actionError("E-mail ou senha incorretos.", undefined, values);
  }

  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login");
}
