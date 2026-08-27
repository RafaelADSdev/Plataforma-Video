"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { isUsableDisplayName, normalizeDisplayName } from "@/lib/profile-name";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createUserAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({
    email: z.email("Digite um e-mail válido."),
    password: z.string().min(8, "A senha inicial deve ter pelo menos 8 caracteres.").max(128),
    display_name: z
      .string()
      .trim()
      .max(80, "Use até 80 caracteres.")
      .refine((value) => value === "" || isUsableDisplayName(value), "Use o nome da pessoa, não o e-mail."),
    role: z.enum(["admin", "professor", "aluno"]),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    display_name: formData.get("display_name") ?? "",
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os dados do usuário.", {
      email: fields.email?.[0] ?? "",
      password: fields.password?.[0] ?? "",
      display_name: fields.display_name?.[0] ?? "",
      role: fields.role?.[0] ?? "",
    });
  }

  const displayName = parsed.data.display_name ? normalizeDisplayName(parsed.data.display_name) : null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      email_confirm: true,
      app_metadata: { role: parsed.data.role },
      user_metadata: displayName ? { display_name: displayName } : {},
    });
    if (error) {
      if (error.message.toLowerCase().includes("already")) return actionError("Já existe uma conta com este e-mail.");
      return actionError("Não foi possível criar a conta. Confira os dados e tente novamente.");
    }
    if (data.user) {
      await admin.from("profiles").update({ display_name: displayName }).eq("id", data.user.id);
    }
  } catch {
    return actionError("A chave administrativa do Supabase não está configurada no servidor.");
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "Conta criada. A pessoa já pode entrar com a senha definida." };
}
