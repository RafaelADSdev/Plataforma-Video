"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { WEEKDAYS } from "@/lib/schedule";
import { MAX_STUDY_PLAN_LENGTH, ROUTINE_WEEKS, type RoutineDay } from "@/lib/study-planner";
import { createClient } from "@/lib/supabase/server";

const entrySchema = z.object({
  courseId: postgresUuidSchema(),
  day: z.object({ week: z.literal(ROUTINE_WEEKS), weekday: z.literal(WEEKDAYS) }),
  note: z.string().trim().max(MAX_STUDY_PLAN_LENGTH),
});

export async function saveStudyPlanDay(courseId: string, day: RoutineDay, note: string) {
  const auth = await requireUser();
  const parsed = entrySchema.safeParse({ courseId, day, note });
  if (!parsed.success) return actionError("Revise a semana, o dia e o texto antes de salvar.");

  const supabase = await createClient();
  const entries = supabase.from("study_routine_days");
  const key = {
    course_id: parsed.data.courseId,
    owner_id: auth.id,
    week_number: parsed.data.day.week,
    weekday: parsed.data.day.weekday,
  };
  const { error } = parsed.data.note
    ? await entries.upsert({ ...key, note: parsed.data.note }, { onConflict: "course_id,owner_id,week_number,weekday" })
    : await entries.delete().match(key);

  if (error) return actionError("Não foi possível salvar este dia. Tente novamente.");

  revalidatePath("/cronograma");
  return { ok: true };
}
