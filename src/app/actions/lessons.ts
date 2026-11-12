"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireProfessor, requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { saoPauloDateTimeInputToIso } from "@/lib/time";
import { isValidYouTubeUrl } from "@/lib/youtube";

export type LessonActionState = ActionState & { lessonId?: string };

const uuid = postgresUuidSchema();

function parseLessonForm(formData: FormData) {
  const youtubeUrl = String(formData.get("youtube_url") ?? "").trim();
  const publishMode = formData.get("publish_mode") === "scheduled" ? "scheduled" : "now";
  const publishLocal = String(formData.get("published_at_local") ?? "");
  const publishedAt = publishMode === "now" ? new Date().toISOString() : saoPauloDateTimeInputToIso(publishLocal);
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();

  const parsed = z.object({
    module_id: postgresUuidSchema("Escolha um módulo."),
    title: z.string().trim().min(2, "Digite o título da aula.").max(160, "Use até 160 caracteres."),
    content: z.string().trim().min(1, "Digite o texto da aula.").max(30_000, "O texto está muito longo."),
    scheduled_for: z.union([z.literal(""), z.iso.date("Use uma data válida no cronograma.")]),
  }).safeParse({
    module_id: formData.get("module_id"),
    title: formData.get("title"),
    content: formData.get("content"),
    scheduled_for: scheduledFor,
  });

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    Object.entries(fields).forEach(([key, messages]) => {
      fieldErrors[key] = messages?.[0] ?? "";
    });
  }
  if (youtubeUrl && !isValidYouTubeUrl(youtubeUrl)) {
    fieldErrors.youtube_url = "Cole uma URL válida do YouTube.";
  }
  if (!publishedAt) {
    fieldErrors.published_at_local = "Escolha uma data e hora válidas para publicar.";
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0 || !publishedAt) {
    return { ok: false as const, state: actionError("Revise os campos indicados.", fieldErrors) };
  }

  return {
    ok: true as const,
    value: {
      module_id: parsed.data.module_id,
      title: parsed.data.title,
      content: parsed.data.content,
      youtube_url: youtubeUrl || null,
      published_at: publishedAt,
      scheduled_for: parsed.data.scheduled_for || null,
    },
  };
}

export async function createLessonAction(
  _state: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  await requireProfessor();
  const parsed = parseLessonForm(formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createClient();
  const { data, error } = await supabase.from("lessons").insert(parsed.value).select("id").single();

  if (error || !data) return actionError("Não foi possível publicar a aula. Tente novamente.");
  revalidatePath("/");
  revalidatePath("/cronograma");
  return { ok: true, message: "Aula salva.", lessonId: data.id };
}

export async function updateLessonAction(
  lessonId: string,
  _state: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  await requireProfessor();
  if (!uuid.safeParse(lessonId).success) return actionError("Aula inválida.");
  const parsed = parseLessonForm(formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update(parsed.value).eq("id", lessonId);
  if (error) return actionError("Não foi possível salvar a aula. Tente novamente.");
  revalidatePath("/");
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/cronograma");
  return { ok: true, message: "Aula atualizada.", lessonId };
}

export async function createLessonCommentAction(
  lessonId: string,
  body: string,
  tSeconds: number | null,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!uuid.safeParse(lessonId).success) return actionError("Aula inválida.");
  const parsedBody = z.string().trim().min(1, "Escreva o comentário.").max(2_000, "Use até 2.000 caracteres.").safeParse(body);
  if (!parsedBody.success) return actionError(parsedBody.error.issues[0]?.message ?? "Comentário inválido.");

  const supabase = await createClient();
  const { data: lesson, error: lessonError } = await supabase.from("lessons").select("youtube_url").eq("id", lessonId).single();
  if (lessonError || !lesson) return actionError("Esta aula não está disponível.");
  const safeSeconds = lesson.youtube_url && typeof tSeconds === "number" && Number.isFinite(tSeconds)
    ? Math.max(0, Math.floor(tSeconds))
    : null;
  const { error } = await supabase.from("lesson_comments").insert({
    lesson_id: lessonId,
    author_id: auth.id,
    body: parsedBody.data,
    t_seconds: safeSeconds,
  });
  if (error) return actionError("Não foi possível enviar o comentário. Tente novamente.");
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Comentário enviado." };
}
