"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import {
  MAX_SCHEDULE_NOTE_LENGTH,
  MAX_WEEKLY_SCHEDULE_SLOTS,
  isScheduleTimeRangeValid,
  parseScheduleTimeInput,
} from "@/lib/schedule";
import { canCopyRecommendedSchedule, canEditPersonalSchedule, canEditRecommendedSchedule } from "@/lib/schedule-permissions";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyScheduleSlot } from "@/types/domain";

const uuid = postgresUuidSchema();
const weekdaySchema = z.coerce.number().int().min(1, "Escolha um dia da semana.").max(7, "Escolha um dia da semana.");
const timeSchema = z.string().trim().min(1, "Informe o horário.");
const optionalTimeSchema = z.string().trim();

type SlotFields = {
  course_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string | null;
  note: string;
};

function scheduleWriteError(error: { code?: string; message?: string } | null, fallback: string): ActionState {
  if (!error) return actionError(fallback);
  if (error.code === "23505") return actionError("Já existe um horário neste dia e hora.");
  if (error.code === "23514") return actionError("O término precisa ser depois do início.");
  if (error.code === "P0001" || error.message?.includes("28 horários")) {
    return actionError("Cada cronograma pode ter no máximo 28 horários.");
  }
  return actionError(fallback);
}

function parseSlotForm(formData: FormData): { data?: SlotFields; fieldErrors?: Record<string, string> } {
  const parsed = z.object({
    course_id: uuid,
    weekday: weekdaySchema,
    starts_at: timeSchema,
    ends_at: optionalTimeSchema,
    note: z.string().trim().max(MAX_SCHEDULE_NOTE_LENGTH, `Use até ${MAX_SCHEDULE_NOTE_LENGTH} caracteres.`),
  }).safeParse({
    course_id: formData.get("course_id"),
    weekday: formData.get("weekday"),
    starts_at: formData.get("starts_at") ?? "",
    ends_at: formData.get("ends_at") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        course_id: fields.course_id?.[0] ?? "",
        weekday: fields.weekday?.[0] ?? "",
        starts_at: fields.starts_at?.[0] ?? "",
        ends_at: fields.ends_at?.[0] ?? "",
        note: fields.note?.[0] ?? "",
      },
    };
  }

  const startsAt = parseScheduleTimeInput(parsed.data.starts_at);
  const endsAtRaw = parsed.data.ends_at;
  const endsAt = endsAtRaw ? parseScheduleTimeInput(endsAtRaw) : null;
  const fieldErrors: Record<string, string> = {};

  if (!startsAt) fieldErrors.starts_at = "Use um horário válido.";
  if (endsAtRaw && !endsAt) fieldErrors.ends_at = "Use um horário válido.";
  if (startsAt && endsAt && !isScheduleTimeRangeValid(startsAt, endsAt)) {
    fieldErrors.ends_at = "O término precisa ser depois do início.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    data: {
      course_id: parsed.data.course_id,
      weekday: parsed.data.weekday,
      starts_at: startsAt!,
      ends_at: endsAt,
      note: parsed.data.note,
    },
  };
}

async function assertCourseExists(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  return Boolean(data);
}

export async function createScheduleSlotAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  const parsed = parseSlotForm(formData);
  if (!parsed.data) {
    return actionError("Revise os campos do horário.", parsed.fieldErrors);
  }
  if (!(await assertCourseExists(parsed.data.course_id))) {
    return actionError("Curso inválido.");
  }

  const ownerId = auth.isStaff ? null : auth.id;
  if (auth.isStaff && !canEditRecommendedSchedule(auth)) {
    return actionError("Você não pode editar o cronograma recomendado.");
  }
  if (!auth.isStaff && !canEditPersonalSchedule(auth)) {
    return actionError("Apenas alunos podem criar um cronograma próprio.");
  }

  const supabase = await createClient();
  const countQuery = supabase
    .from("weekly_schedule_slots")
    .select("id", { count: "exact", head: true })
    .eq("course_id", parsed.data.course_id);
  const { count } = ownerId
    ? await countQuery.eq("owner_id", ownerId)
    : await countQuery.is("owner_id", null);

  if ((count ?? 0) >= MAX_WEEKLY_SCHEDULE_SLOTS) {
    return actionError("Cada cronograma pode ter no máximo 28 horários.");
  }

  const { error } = await supabase.from("weekly_schedule_slots").insert({
    course_id: parsed.data.course_id,
    owner_id: ownerId,
    weekday: parsed.data.weekday,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at,
    note: parsed.data.note,
  });

  if (error) return scheduleWriteError(error, "Não foi possível adicionar o horário. Tente novamente.");
  revalidatePath("/cronograma");
  return { ok: true, message: "Horário adicionado." };
}

export async function updateScheduleSlotAction(
  slotId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!uuid.safeParse(slotId).success) return actionError("Horário inválido.");
  const parsed = parseSlotForm(formData);
  if (!parsed.data) {
    return actionError("Revise os campos do horário.", parsed.fieldErrors);
  }
  if (auth.isStaff && !canEditRecommendedSchedule(auth)) {
    return actionError("Você não pode editar o cronograma recomendado.");
  }
  if (!auth.isStaff && !canEditPersonalSchedule(auth)) {
    return actionError("Apenas alunos podem editar o próprio cronograma.");
  }

  const supabase = await createClient();
  let query = supabase.from("weekly_schedule_slots").update({
    weekday: parsed.data.weekday,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at,
    note: parsed.data.note,
  }).eq("id", slotId).eq("course_id", parsed.data.course_id);

  query = auth.isStaff ? query.is("owner_id", null) : query.eq("owner_id", auth.id);

  const { error, data } = await query.select("id").maybeSingle();
  if (error) return scheduleWriteError(error, "Não foi possível salvar o horário. Tente novamente.");
  if (!data) return actionError("Horário não encontrado.");
  revalidatePath("/cronograma");
  return { ok: true, message: "Horário atualizado." };
}

export async function deleteScheduleSlotAction(slotId: string): Promise<ActionState> {
  const auth = await requireUser();
  if (!uuid.safeParse(slotId).success) return actionError("Horário inválido.");
  if (auth.isStaff && !canEditRecommendedSchedule(auth)) {
    return actionError("Você não pode editar o cronograma recomendado.");
  }
  if (!auth.isStaff && !canEditPersonalSchedule(auth)) {
    return actionError("Apenas alunos podem editar o próprio cronograma.");
  }

  const supabase = await createClient();
  let query = supabase.from("weekly_schedule_slots").delete().eq("id", slotId);
  query = auth.isStaff ? query.is("owner_id", null) : query.eq("owner_id", auth.id);
  const { error, data } = await query.select("id").maybeSingle();
  if (error) return actionError("Não foi possível excluir o horário. Tente novamente.");
  if (!data) return actionError("Horário não encontrado.");
  revalidatePath("/cronograma");
  return { ok: true, message: "Horário excluído." };
}

export async function copyRecommendedScheduleAction(courseId: string): Promise<ActionState> {
  const auth = await requireUser();
  if (!uuid.safeParse(courseId).success) return actionError("Curso inválido.");
  if (!canCopyRecommendedSchedule(auth)) {
    return actionError("Apenas alunos podem copiar o cronograma do professor.");
  }

  const supabase = await createClient();
  const { data: recommendedData, error: recommendedError } = await supabase
    .from("weekly_schedule_slots")
    .select("course_id,weekday,starts_at,ends_at,note")
    .eq("course_id", courseId)
    .is("owner_id", null)
    .order("weekday")
    .order("starts_at");

  if (recommendedError) return actionError("Não foi possível ler o cronograma recomendado.");
  const recommended = (recommendedData ?? []) as Pick<WeeklyScheduleSlot, "course_id" | "weekday" | "starts_at" | "ends_at" | "note">[];
  if (recommended.length === 0) {
    return actionError("O professor ainda não definiu um cronograma recomendado.");
  }
  if (recommended.length > MAX_WEEKLY_SCHEDULE_SLOTS) {
    return actionError("Cada cronograma pode ter no máximo 28 horários.");
  }

  const { error: deleteError } = await supabase
    .from("weekly_schedule_slots")
    .delete()
    .eq("course_id", courseId)
    .eq("owner_id", auth.id);

  if (deleteError) return actionError("Não foi possível substituir o seu cronograma. Tente novamente.");

  const { error: insertError } = await supabase.from("weekly_schedule_slots").insert(
    recommended.map((slot) => ({
      course_id: slot.course_id,
      owner_id: auth.id,
      weekday: slot.weekday,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      note: slot.note,
    })),
  );

  if (insertError) {
    return scheduleWriteError(
      insertError,
      "O cronograma anterior foi apagado, mas a cópia falhou. Tente copiar de novo.",
    );
  }

  revalidatePath("/cronograma");
  return { ok: true, message: "Cronograma do professor copiado para o seu." };
}
