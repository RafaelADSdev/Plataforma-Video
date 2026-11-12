import "server-only";
import { getAuthContext } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Lesson } from "@/types/domain";

export type LessonVideoState = Lesson["video_status"];
export type UploadState = "uploading" | "processing" | "failed";

export type LessonMedia = {
  stream_uid: string | null;
  legacy_youtube_url: string | null;
  pending_uid: string | null;
  upload_id: string | null;
  upload_fingerprint: string | null;
  upload_url: string | null;
  upload_expires_at: string | null;
  upload_state: UploadState | null;
};

export const mediaColumns = "stream_uid,legacy_youtube_url,pending_uid,upload_id,upload_fingerprint,upload_url,upload_expires_at,upload_state";
export const clearUpload = {
  pending_uid: null, upload_id: null, upload_fingerprint: null, upload_url: null, upload_expires_at: null, upload_state: null,
};

export function mediaResponse(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function sameRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const target = new URL(request.url);
  if (origin === target.origin) return true;
  // Next normalizes loopback hostnames in Request.url. The incoming Host
  // header still matches the browser's origin.
  const host = request.headers.get("host");
  return Boolean(host && origin === `${target.protocol}//${host}`);
}

export async function authorizeLessonMedia(id: string, staffOnly = false) {
  const auth = await getAuthContext();
  if (!auth) return { error: mediaResponse({ error: "Entre na sua conta para continuar." }, 401) };
  if (staffOnly && !auth.isStaff) return { error: mediaResponse({ error: "Apenas a equipe pode gerenciar gravações." }, 403) };
  if (!postgresUuidSchema().safeParse(id).success) return { error: mediaResponse({ error: "Aula inválida." }, 404) };
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.id !== auth.id || user.app_metadata.role !== auth.role
    || (user.banned_until && Date.parse(user.banned_until) > Date.now())) {
    return { error: mediaResponse({ error: "Entre novamente para continuar." }, 401) };
  }
  const { data, error } = await supabase.from("lessons").select("id,title,video_status").eq("id", id).maybeSingle();
  if (error) return { error: mediaResponse({ error: "Não foi possível consultar a aula." }, 503) };
  if (!data) return { error: mediaResponse({ error: "Aula indisponível." }, 404) };
  return { lesson: data as Pick<Lesson, "id" | "title" | "video_status"> };
}
