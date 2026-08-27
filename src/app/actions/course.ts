"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireProfessor } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const uuid = postgresUuidSchema();
const dateValue = z.union([z.literal(""), z.iso.date("Use uma data válida.")]);

export async function updateCourseAction(
  courseId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfessor();
  const parsed = z.object({
    title: z.string().trim().min(2, "Digite um título.").max(120, "Use até 120 caracteres."),
    description: z.string().trim().max(320, "Use até 320 caracteres."),
    cover_path: z.string().trim().max(500),
  }).safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    cover_path: formData.get("cover_path") ?? "",
  });

  if (!uuid.safeParse(courseId).success || !parsed.success) {
    const fields = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    return actionError("Revise os dados do curso.", {
      title: fields.title?.[0] ?? "",
      description: fields.description?.[0] ?? "",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({
    title: parsed.data.title,
    description: parsed.data.description || null,
    cover_path: parsed.data.cover_path || null,
  }).eq("id", courseId);

  if (error) return actionError("Não foi possível salvar o curso. Tente novamente.");

  revalidatePath("/");
  revalidatePath("/course/edit");
  return { ok: true, message: "Curso atualizado." };
}

export async function createModuleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfessor();
  const parsed = z.object({
    course_id: uuid,
    title: z.string().trim().min(2, "Digite o título do módulo.").max(120),
    scheduled_for: dateValue,
  }).safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    scheduled_for: formData.get("scheduled_for") ?? "",
  });

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os campos do módulo.", {
      title: fields.title?.[0] ?? "",
      scheduled_for: fields.scheduled_for?.[0] ?? "",
    });
  }

  const supabase = await createClient();
  const { data: last, error: positionError } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", parsed.data.course_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (positionError) return actionError("Não foi possível calcular a ordem do módulo.");

  const { error } = await supabase.from("modules").insert({
    course_id: parsed.data.course_id,
    title: parsed.data.title,
    scheduled_for: parsed.data.scheduled_for || null,
    position: (last?.position ?? 0) + 1,
  });

  if (error) return actionError("Não foi possível criar o módulo. Tente novamente.");
  revalidatePath("/");
  return { ok: true, message: "Módulo criado." };
}

export async function updateModuleAction(
  moduleId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfessor();
  const parsed = z.object({
    title: z.string().trim().min(2, "Digite o título do módulo.").max(120),
    scheduled_for: dateValue,
  }).safeParse({
    title: formData.get("title"),
    scheduled_for: formData.get("scheduled_for") ?? "",
  });

  if (!uuid.safeParse(moduleId).success) {
    return actionError("Módulo inválido.");
  }
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os campos do módulo.", {
      title: fields.title?.[0] ?? "",
      scheduled_for: fields.scheduled_for?.[0] ?? "",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("modules").update({
    title: parsed.data.title,
    scheduled_for: parsed.data.scheduled_for || null,
  }).eq("id", moduleId);

  if (error) return actionError("Não foi possível salvar o módulo.");
  revalidatePath("/");
  revalidatePath("/cronograma");
  return { ok: true, message: "Módulo atualizado." };
}

export async function reorderModuleAction(
  moduleId: string,
  direction: "up" | "down",
): Promise<ActionState> {
  await requireProfessor();
  if (!uuid.safeParse(moduleId).success) return actionError("Módulo inválido.");
  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("modules")
    .select("id, course_id, position")
    .eq("id", moduleId)
    .single();

  if (currentError || !current) return actionError("Módulo não encontrado.");

  let query = supabase
    .from("modules")
    .select("id, position")
    .eq("course_id", current.course_id);
  query = direction === "up"
    ? query.lt("position", current.position).order("position", { ascending: false })
    : query.gt("position", current.position).order("position", { ascending: true });
  const { data: neighbor, error: neighborError } = await query.limit(1).maybeSingle();

  if (neighborError) return actionError("Não foi possível reordenar os módulos.");
  if (!neighbor) return { ok: true };

  const first = await supabase.from("modules").update({ position: neighbor.position }).eq("id", current.id);
  if (first.error) return actionError("Não foi possível reordenar os módulos.");
  const second = await supabase.from("modules").update({ position: current.position }).eq("id", neighbor.id);
  if (second.error) {
    await supabase.from("modules").update({ position: current.position }).eq("id", current.id);
    return actionError("A ordem não foi salva. Tente novamente.");
  }

  revalidatePath("/");
  return { ok: true };
}
