import { postgresUuidSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubmissionMessage } from "@/types/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

const MESSAGE_COLUMNS =
  "id,lesson_id,student_id,author_id,body,storage_path,file_name,mime_type,size_bytes,created_at";

function isMissingTable(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "PGRST205" || /could not find the table|schema cache|does not exist/i.test(message);
}

function messagesPrefix(lessonId: string, studentId: string) {
  return `${studentId}/${lessonId}/messages`;
}

export type NewSubmissionMessage = {
  lessonId: string;
  studentId: string;
  authorId: string;
  body: string;
  storagePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export async function listSubmissionMessages(
  userClient: SupabaseClient,
  lessonId: string,
  studentIds: string[],
): Promise<SubmissionMessage[]> {
  const queried = await userClient
    .from("submission_messages")
    .select(MESSAGE_COLUMNS)
    .eq("lesson_id", lessonId)
    .order("created_at");
  if (queried.error && !isMissingTable(queried.error)) return [];

  const fromTable = queried.error ? [] : ((queried.data ?? []) as SubmissionMessage[]);
  const fromStorage = await listStoredMessages(createAdminClient(), lessonId, studentIds);
  const byId = new Map<string, SubmissionMessage>();
  for (const item of [...fromTable, ...fromStorage]) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function insertSubmissionMessage(
  userClient: SupabaseClient,
  input: NewSubmissionMessage,
): Promise<SubmissionMessage | null> {
  const row = {
    lesson_id: input.lessonId,
    student_id: input.studentId,
    author_id: input.authorId,
    body: input.body,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
  };

  const inserted = await userClient.from("submission_messages").insert(row).select(MESSAGE_COLUMNS).maybeSingle();
  if (!inserted.error && inserted.data) return inserted.data as SubmissionMessage;

  const admin = createAdminClient();
  if (inserted.error && !isMissingTable(inserted.error)) {
    const retry = await admin.from("submission_messages").insert(row).select(MESSAGE_COLUMNS).maybeSingle();
    if (!retry.error && retry.data) return retry.data as SubmissionMessage;
    if (retry.error && !isMissingTable(retry.error)) return null;
  }
  return storeMessage(admin, input);
}

export async function uploadFeedbackFile(
  path: string,
  file: File,
  mimeType: string,
) {
  const admin = createAdminClient();
  const payload = new File([file], file.name, { type: mimeType });
  const uploaded = await admin.storage.from("feedback").upload(path, payload, {
    contentType: mimeType,
    cacheControl: "3600",
  });
  return !uploaded.error;
}

async function listStoredMessages(
  admin: ReturnType<typeof createAdminClient>,
  lessonId: string,
  studentIds: string[],
): Promise<SubmissionMessage[]> {
  const folders = studentIds.filter((id) => postgresUuidSchema().safeParse(id).success);
  const lists = await Promise.all(
    folders.map(async (studentId) => {
      const listed = await admin.storage.from("feedback").list(messagesPrefix(lessonId, studentId), {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });
      const files = (listed.data ?? []).filter((item) => item.name.endsWith(".json"));
      const rows = await Promise.all(
        files.map(async (file) => {
          const downloaded = await admin.storage
            .from("feedback")
            .download(`${messagesPrefix(lessonId, studentId)}/${file.name}`);
          if (downloaded.error || !downloaded.data) return null;
          try {
            return JSON.parse(await downloaded.data.text()) as SubmissionMessage;
          } catch {
            return null;
          }
        }),
      );
      return rows.filter((item): item is SubmissionMessage => Boolean(item?.id));
    }),
  );
  return lists.flat().sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function storeMessage(
  admin: ReturnType<typeof createAdminClient>,
  input: NewSubmissionMessage,
): Promise<SubmissionMessage | null> {
  const createdAt = new Date().toISOString();
  const message: SubmissionMessage = {
    id: crypto.randomUUID(),
    lesson_id: input.lessonId,
    student_id: input.studentId,
    author_id: input.authorId,
    body: input.body,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    created_at: createdAt,
  };
  const path = `${messagesPrefix(input.lessonId, input.studentId)}/${Date.parse(createdAt)}-${message.id}.json`;
  const uploaded = await admin.storage.from("feedback").upload(
    path,
    new Blob([JSON.stringify(message)], { type: "application/json" }),
    { contentType: "application/json", cacheControl: "3600" },
  );
  if (uploaded.error) return null;
  return message;
}
