"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { isUsableDisplayName, normalizeDisplayName } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";

function profileError(error: { code?: string; message?: string } | null, fallback: string) {
  console.error(fallback, error);
  if (error?.code === "42501") return actionError("Você não tem permissão para atualizar este perfil.");
  return actionError("Não foi possível salvar o perfil. Tente novamente.");
}

export async function updateProfileAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  const parsed = z.object({
    display_name: z
      .string()
      .trim()
      .min(2, "Digite o nome que aparece para a turma.")
      .max(80, "Use até 80 caracteres.")
      .refine(
        (value) => isUsableDisplayName(value, auth.email),
        "Use seu nome, não o e-mail da conta.",
      ),
    bio: z.string().trim().max(280, "Use até 280 caracteres."),
    avatar_path: z.string().trim().max(500),
  }).safeParse({
    display_name: formData.get("display_name") ?? "",
    bio: formData.get("bio") ?? "",
    avatar_path: formData.get("avatar_path") ?? "",
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os dados do perfil.", {
      display_name: fields.display_name?.[0] ?? "",
      bio: fields.bio?.[0] ?? "",
    });
  }

  if (parsed.data.avatar_path && !parsed.data.avatar_path.startsWith(`${auth.id}/`)) {
    return actionError("A foto de perfil é inválida.");
  }

  const supabase = await createClient();
  const profileValues = {
    display_name: normalizeDisplayName(parsed.data.display_name),
    bio: parsed.data.bio || null,
    avatar_path: parsed.data.avatar_path || null,
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from("profiles")
    .update(profileValues)
    .eq("id", auth.id)
    .select("id");

  if (updateError) return profileError(updateError, "Não foi possível atualizar o perfil");

  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: auth.id,
      ...profileValues,
    });
    if (insertError?.code === "23505") {
      const { data: retried, error: retryError } = await supabase
        .from("profiles")
        .update(profileValues)
        .eq("id", auth.id)
        .select("id");
      if (retryError || !retried?.length) {
        return profileError(retryError, "Não foi possível confirmar o perfil");
      }
    } else if (insertError) {
      return profileError(insertError, "Não foi possível criar o perfil");
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/perfil");
  revalidatePath("/comunidade");
  return { ok: true, message: "Perfil atualizado." };
}
