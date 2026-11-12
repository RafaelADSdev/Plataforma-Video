import { formatDateTimeInSaoPaulo, isFutureDate } from "@/lib/time";
import type { Activity } from "@/types/domain";

export const activityColumns = "id,module_id,lesson_id,kind,title,instructions,position,published_at,due_at,support_path,support_name";
export const activitySummaryColumns = "id,module_id,lesson_id,kind,title,position,published_at,due_at,submissions(count),quiz_attempts(count)";
export const quizAttemptColumns = "id,user_id,attempt_number,answers,correct_count,question_count,created_at";

export type ActivitySummary = Pick<Activity, "id" | "module_id" | "lesson_id" | "kind" | "title" | "position" | "published_at" | "due_at"> & {
  submissions: { count: number }[];
  quiz_attempts: { count: number }[];
};

export function activityKindLabel(kind: Activity["kind"]) {
  return kind === "file" ? "Entrega em arquivo" : "Questionário";
}

export function activityResponseCount(activity: ActivitySummary) {
  return activity.kind === "file" ? activity.submissions[0]?.count ?? 0 : activity.quiz_attempts[0]?.count ?? 0;
}

export function activityPublication(publishedAt: string | null) {
  if (!publishedAt) return { label: "Rascunho", tone: "" };
  if (isFutureDate(publishedAt)) return { label: `Agendada · ${formatDateTimeInSaoPaulo(publishedAt)}`, tone: "warning" };
  return { label: "Publicada", tone: "success" };
}

export function byActivityDueDate(a: ActivitySummary, b: ActivitySummary) {
  if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
  if (a.due_at) return -1;
  if (b.due_at) return 1;
  return a.title.localeCompare(b.title, "pt-BR");
}
