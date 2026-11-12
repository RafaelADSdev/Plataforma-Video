import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Submission, SubmissionMessage } from "@/types/domain";

const messageColumns = "id,activity_id,student_id,author_id,body,storage_path,file_name,mime_type,size_bytes,created_at";

export async function listSubmissionMessages(
  client: SupabaseClient,
  activityId: string,
  visibleSubmissions: Submission[],
  legacy: boolean,
): Promise<SubmissionMessage[]> {
  const { data, error } = await client.from("submission_messages")
    .select(messageColumns).eq("activity_id", activityId).order("created_at");
  if (error) throw new Error("Não foi possível consultar as conversas da atividade.");
  const rows = (data ?? []) as SubmissionMessage[];
  if (!legacy || !visibleSubmissions.length) return rows;

  // v1 used JSON files when the feedback table was unavailable. Only look up
  // folders for submissions already authorized by the user's RLS query.
  const admin = createAdminClient();
  const lists = await Promise.all(visibleSubmissions.map(async ({ user_id: studentId }) => {
    const prefix = `${studentId}/${activityId}/messages`;
    const { data: files } = await admin.storage.from("feedback").list(prefix, { limit: 200 });
    return Promise.all((files ?? []).filter(({ name }) => name.endsWith(".json")).map(async ({ name }) => {
      const { data: file } = await admin.storage.from("feedback").download(`${prefix}/${name}`);
      if (!file) return null;
      try {
        const message = JSON.parse(await file.text()) as SubmissionMessage & { lesson_id?: string };
        if (message.lesson_id !== activityId || message.student_id !== studentId || !message.id) return null;
        return { ...message, activity_id: activityId };
      } catch {
        return null;
      }
    }));
  }));
  const combined = new Map(rows.map((row) => [row.id, row]));
  for (const row of lists.flat()) {
    if (row && !combined.has(row.id)) combined.set(row.id, row);
  }
  return [...combined.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
