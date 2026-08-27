"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Digite um e-mail válido."),
  password: z.string().min(1, "Digite a senha."),
});

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os campos indicados.", {
      email: fields.email?.[0] ?? "",
      password: fields.password?.[0] ?? "",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return actionError("E-mail ou senha incorretos. Confira os dados e tente novamente.");
  }

  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
