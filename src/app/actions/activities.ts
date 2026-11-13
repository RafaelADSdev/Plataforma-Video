"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/action-state";
import { requireProfessor, requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { canWriteSubmissionMessage } from "@/lib/submission-permissions";
import { createClient } from "@/lib/supabase/server";
import { saoPauloDateTimeInputToIso } from "@/lib/time";

const uuid = postgresUuidSchema();
const optionSchema = z.object({ id: uuid, text: z.string().trim().min(1).max(500) });
const questionSchema = z.object({
  id: uuid,
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(optionSchema).min(2).max(6),
  correctOptionId: uuid,
}).refine((question) => question.options.some((option) => option.id === question.correctOptionId));
const questionsSchema = z.array(questionSchema).min(1).max(50);
const fileSchema = z.object({ path: z.string().min(1).max(500), name: z.string().trim().min(1).max(255) });

type ActivityActionResult = ActionState & { activityId?: string };

export async function saveActivityAction(
  activityId: string,
  formData: FormData,
  attachment: { path: string; name: string } | null,
): Promise<ActivityActionResult> {
  await requireProfessor();
  const parsed = z.object({
    id: uuid,
    moduleId: uuid,
    lessonId: z.union([z.literal(""), uuid]),
    kind: z.enum(["file", "quiz"]),
    title: z.string().trim().min(2).max(160),
    instructions: z.string().trim().max(12000),
    publication: z.enum(["draft", "now", "scheduled"]),
  }).safeParse({
    id: activityId, moduleId: formData.get("module_id"), lessonId: formData.get("lesson_id"),
    kind: formData.get("kind"), title: formData.get("title"), instructions: formData.get("instructions"),
    publication: formData.get("publication"),
  });
  if (!parsed.success) return actionError("Confira o título, o módulo e o formato da atividade.");
  const input = parsed.data;
  const dueInput = String(formData.get("due_at") ?? "");
  const dueAt = dueInput ? saoPauloDateTimeInputToIso(dueInput) : null;
  const scheduleAt = input.publication === "scheduled"
    ? saoPauloDateTimeInputToIso(String(formData.get("published_at") ?? ""))
    : null;
  if (dueInput && !dueAt) return actionError("Informe um prazo válido.");
  if (input.publication === "scheduled" && (!scheduleAt || Date.parse(scheduleAt) <= Date.now())) {
    return actionError("Escolha uma data futura para publicar.");
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from("activities")
    .select("module_id,published_at,lesson_id,support_path,support_name").eq("id", activityId).maybeSingle();
  if (existingError) return actionError("Não foi possível consultar a atividade. Tente novamente.");
  const publishedAt = input.publication === "now"
    ? existing?.published_at && Date.parse(existing.published_at) <= Date.now() ? existing.published_at : new Date().toISOString()
    : scheduleAt;
  if (publishedAt && dueAt && Date.parse(dueAt) < Date.parse(publishedAt)) return actionError("O prazo precisa ser posterior à publicação.");

  const uploaded = fileSchema.nullable().safeParse(attachment);
  if (!uploaded.success || (uploaded.data && (input.kind !== "file" || !uploaded.data.path.startsWith(`${activityId}/`)))) {
    return actionError("O PDF de apoio é inválido.");
  }
  const support = input.kind === "file" && formData.get("remove_support") !== "on"
    ? uploaded.data ?? { path: existing?.support_path ?? null, name: existing?.support_name ?? null }
    : null;

  let questions = null;
  const encodedQuestions = formData.get("questions");
  if (input.kind === "quiz" && typeof encodedQuestions === "string") {
    try {
      const parsedQuestions = questionsSchema.safeParse(JSON.parse(encodedQuestions));
      if (!parsedQuestions.success) return actionError("Preencha as questões e marque a resposta correta de cada uma.");
      questions = parsedQuestions.data;
    } catch {
      return actionError("Confira as questões antes de salvar.");
    }
  }

  const { error } = await supabase.rpc("save_course_activity", {
    p_id: activityId,
    p_module_id: input.moduleId,
    p_lesson_id: input.lessonId || null,
    p_kind: input.kind,
    p_title: input.title,
    p_instructions: input.instructions,
    p_published_at: publishedAt,
    p_due_at: dueAt,
    p_support_path: support?.path ?? null,
    p_support_name: support?.name ?? null,
    p_questions: questions,
    p_allow_retries: formData.get("allow_retries") === "on",
    p_show_answers: formData.get("show_answers") === "on",
  });
  if (error) return actionError(error.code === "P0001" ? error.message : "Não foi possível salvar a atividade. Tente novamente.");
  revalidatePath("/");
  revalidatePath(`/course/modules/${input.moduleId}`);
  if (existing && existing.module_id !== input.moduleId) revalidatePath(`/course/modules/${existing.module_id}`);
  revalidatePath("/atividades");
  revalidatePath(`/atividades/${activityId}`);
  if (input.lessonId) revalidatePath(`/lessons/${input.lessonId}`);
  if (existing?.lesson_id && existing.lesson_id !== input.lessonId) revalidatePath(`/lessons/${existing.lesson_id}`);
  return { ok: true, activityId };
}

export async function recordSubmissionAction(
  activityId: string,
  file: { path: string; name: string },
): Promise<ActionState> {
  const auth = await requireUser();
  const parsed = fileSchema.safeParse(file);
  if (auth.role !== "aluno" || !uuid.safeParse(activityId).success || !parsed.success) {
    return actionError("Dados da entrega inválidos.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_activity_submission", {
    p_activity_id: activityId, p_path: parsed.data.path, p_filename: parsed.data.name,
  });
  if (error) return actionError("Não foi possível registrar a entrega. Tente novamente.");
  revalidatePath("/");
  revalidatePath("/atividades");
  revalidatePath(`/atividades/${activityId}`);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Entrega enviada." };
}

export async function createSubmissionMessageAction(
  activityId: string,
  studentId: string,
  body: string,
  attachment: { path: string; name: string } | null,
): Promise<ActionState> {
  const auth = await requireUser();
  const text = z.string().trim().max(4000).safeParse(body);
  const file = fileSchema.nullable().safeParse(attachment);
  if (!uuid.safeParse(activityId).success || !uuid.safeParse(studentId).success
    || !canWriteSubmissionMessage(auth, studentId) || !text.success || !file.success || (!text.data && !file.data)) {
    return actionError("Informe uma mensagem ou anexo válido.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_activity_feedback", {
    p_activity_id: activityId, p_student_id: studentId, p_body: text.data,
    p_path: file.data?.path ?? null, p_filename: file.data?.name ?? null,
  });
  if (error) return actionError("Não foi possível enviar a mensagem. Tente novamente.");
  revalidatePath(`/atividades/${activityId}`);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Mensagem enviada." };
}

export async function submitQuizAction(
  activityId: string,
  revision: string,
  requestId: string,
  answers: Record<string, string>,
): Promise<ActionState> {
  const auth = await requireUser();
  const parsed = z.object({
    activityId: uuid, revision: uuid, requestId: uuid, answers: z.record(uuid, uuid),
  }).safeParse({ activityId, revision, requestId, answers });
  if (auth.role !== "aluno" || !parsed.success || Object.keys(parsed.data.answers).length > 50) {
    return actionError("Confira as respostas antes de enviar.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_activity_quiz", {
    p_activity_id: activityId, p_revision: revision, p_request_id: requestId, p_answers: parsed.data.answers,
  });
  if (error || !data) return actionError(error?.code === "P0001" ? error.message : "Não foi possível enviar as respostas. Tente novamente.");
  revalidatePath("/");
  revalidatePath("/atividades");
  revalidatePath(`/atividades/${activityId}`);
  return { ok: true, message: `Respostas enviadas. Você acertou ${data.correct_count} de ${data.question_count} questões.` };
}

export async function reorderCourseItemAction(
  moduleId: string, id: string, kind: "lesson" | "activity", direction: "up" | "down",
): Promise<ActionState> {
  await requireProfessor();
  if (!uuid.safeParse(moduleId).success || !uuid.safeParse(id).success || !["up", "down"].includes(direction)) {
    return actionError("Item inválido.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_course_item", {
    p_module_id: moduleId, p_item_id: id, p_is_activity: kind === "activity", p_direction: direction,
  });
  if (error) return actionError("Não foi possível alterar a ordem. Tente novamente.");
  revalidatePath("/");
  revalidatePath(`/course/modules/${moduleId}`);
  return { ok: true };
}
