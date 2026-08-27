"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireProfessor, requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { sanitizeStorageName } from "@/lib/storage";
import { insertSubmissionMessage, uploadFeedbackFile } from "@/lib/submission-messages";
import { canWriteSubmissionMessage } from "@/lib/submission-permissions";
import { createClient } from "@/lib/supabase/server";
import { saoPauloDateTimeInputToIso } from "@/lib/time";
import { validateSubmissionFile } from "@/lib/validation";
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
      requires_submission: formData.get("requires_submission") === "on",
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
  const { data: last, error: positionError } = await supabase
    .from("lessons")
    .select("position")
    .eq("module_id", parsed.value.module_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) return actionError("Não foi possível calcular a ordem da aula.");

  const { data, error } = await supabase.from("lessons").insert({
    ...parsed.value,
    position: (last?.position ?? 0) + 1,
  }).select("id").single();

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

export async function reorderLessonAction(
  lessonId: string,
  direction: "up" | "down",
): Promise<ActionState> {
  await requireProfessor();
  if (!uuid.safeParse(lessonId).success) return actionError("Aula inválida.");
  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("lessons")
    .select("id,module_id,position")
    .eq("id", lessonId)
    .single();
  if (currentError || !current) return actionError("Aula não encontrada.");

  let query = supabase.from("lessons").select("id,position").eq("module_id", current.module_id);
  query = direction === "up"
    ? query.lt("position", current.position).order("position", { ascending: false })
    : query.gt("position", current.position).order("position", { ascending: true });
  const { data: neighbor, error: neighborError } = await query.limit(1).maybeSingle();
  if (neighborError) return actionError("Não foi possível reordenar as aulas.");
  if (!neighbor) return { ok: true };

  const first = await supabase.from("lessons").update({ position: neighbor.position }).eq("id", current.id);
  if (first.error) return actionError("Não foi possível reordenar as aulas.");
  const second = await supabase.from("lessons").update({ position: current.position }).eq("id", neighbor.id);
  if (second.error) {
    await supabase.from("lessons").update({ position: current.position }).eq("id", current.id);
    return actionError("A ordem não foi salva. Tente novamente.");
  }
  revalidatePath("/");
  return { ok: true };
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

export async function recordSubmissionAction(
  lessonId: string,
  input: { storagePath: string; fileName: string; mimeType: string; sizeBytes: number },
): Promise<ActionState> {
  const auth = await requireUser();
  if (auth.role !== "aluno") return actionError("Apenas alunos enviam entregas.");
  const parsed = z.object({
    storagePath: z.string().startsWith(`${auth.id}/${lessonId}/`).max(500),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  }).safeParse(input);
  if (!uuid.safeParse(lessonId).success || !parsed.success) return actionError("Dados da entrega inválidos.");
  const supabase = await createClient();
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("requires_submission")
    .eq("id", lessonId)
    .single();
  if (lessonError || !lesson?.requires_submission) return actionError("Esta aula não está aceitando entrega.");

  const { error } = await supabase.from("submissions").upsert({
    lesson_id: lessonId,
    user_id: auth.id,
    storage_path: parsed.data.storagePath,
    file_name: parsed.data.fileName,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,lesson_id" });
  if (error) return actionError("O arquivo foi enviado, mas a entrega não foi registrada. Tente novamente.");
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Entrega enviada." };
}

export async function createSubmissionMessageAction(
  lessonId: string,
  studentId: string,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!uuid.safeParse(lessonId).success || !uuid.safeParse(studentId).success) {
    return actionError("Conversa inválida.");
  }
  if (!canWriteSubmissionMessage(auth, studentId)) {
    return actionError("Você não pode responder nesta conversa.");
  }

  const parsedBody = z.string().max(4_000, "Use até 4.000 caracteres.").safeParse(String(formData.get("body") ?? ""));
  if (!parsedBody.success) return actionError(parsedBody.error.issues[0]?.message ?? "Mensagem inválida.");
  const body = parsedBody.data.trim();
  const attachment = formData.get("attachment");
  const file = attachment instanceof File && attachment.size > 0 ? attachment : null;
  if (!body && !file) return actionError("Escreva uma mensagem ou anexe a atividade corrigida.");

  let storedFile: {
    storagePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  } | null = null;
  if (file) {
    const validation = validateSubmissionFile(file);
    if (!validation.ok) return actionError(validation.error);
    const storagePath = `${studentId}/${lessonId}/${auth.id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
    const uploaded = await uploadFeedbackFile(storagePath, file, validation.mimeType);
    if (!uploaded) return actionError("Não foi possível enviar o arquivo. Tente novamente.");
    storedFile = {
      storagePath,
      fileName: file.name,
      mimeType: validation.mimeType,
      sizeBytes: file.size,
    };
  }

  const supabase = await createClient();
  const [{ data: lesson, error: lessonError }, { data: submission, error: submissionError }] = await Promise.all([
    supabase.from("lessons").select("id,requires_submission").eq("id", lessonId).maybeSingle(),
    supabase.from("submissions").select("id").eq("lesson_id", lessonId).eq("user_id", studentId).maybeSingle(),
  ]);
  if (lessonError || !lesson?.requires_submission) return actionError("Esta aula não está aceitando conversa de entrega.");
  if (submissionError || !submission) return actionError("A conversa só abre depois que o aluno envia a entrega.");

  const saved = await insertSubmissionMessage(supabase, {
    lessonId,
    studentId,
    authorId: auth.id,
    body,
    storagePath: storedFile?.storagePath ?? null,
    fileName: storedFile?.fileName ?? null,
    mimeType: storedFile?.mimeType ?? null,
    sizeBytes: storedFile?.sizeBytes ?? null,
  });
  if (!saved) return actionError("Não foi possível enviar a mensagem. Tente novamente.");

  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Mensagem enviada." };
}
