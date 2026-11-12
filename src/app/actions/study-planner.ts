"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { isPlannerMonth, MAX_STUDY_PLAN_LENGTH } from "@/lib/study-planner";
import { createClient } from "@/lib/supabase/server";

const entrySchema = z.object({
  courseId: postgresUuidSchema(),
  date: z.iso.date().refine((date) => isPlannerMonth(date.slice(0, 7))),
  note: z.string().trim().max(MAX_STUDY_PLAN_LENGTH),
});

export async function saveStudyPlanDay(courseId: string, date: string, note: string) {
  const auth = await requireUser();
  const parsed = entrySchema.safeParse({ courseId, date, note });
  if (!parsed.success) return actionError("Revise a data e o texto antes de salvar.");

  const supabase = await createClient();
  const entries = supabase.from("study_planner_days");
  const entry = {
    course_id: parsed.data.courseId,
    owner_id: auth.id,
    study_date: parsed.data.date,
    note: parsed.data.note,
  };
  const { error } = entry.note
    ? await entries.upsert(entry, { onConflict: "course_id,owner_id,study_date" })
    : await entries.delete().match({
        course_id: entry.course_id,
        owner_id: entry.owner_id,
        study_date: entry.study_date,
      });

  if (error) return actionError("Não foi possível salvar este dia. Tente novamente.");

  revalidatePath("/cronograma");
  return { ok: true };
}
