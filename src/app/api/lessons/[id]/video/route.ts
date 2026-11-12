import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createStreamUpload, discardStreamUpload, ensurePrivateStream, getStreamVideo, StreamError } from "@/lib/cloudflare-stream";
import { authorizeLessonMedia, clearUpload, mediaColumns, mediaResponse, sameRequestOrigin, type LessonMedia } from "@/lib/lesson-media";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractYouTubeVideoId } from "@/lib/youtube";

type Context = { params: Promise<{ id: string }> };
const uploadLifetime = 6 * 60 * 60 * 1000;
const reservationTimeout = 60_000;
const uploadInput = z.object({
  size: z.number().int().positive().max(30_000_000_000),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

function summarize(media: LessonMedia | null) {
  const legacyId = media?.legacy_youtube_url ? extractYouTubeVideoId(media.legacy_youtube_url) : null;
  return {
    videoStatus: media?.stream_uid ? "ready" : media?.upload_state ?? (media?.legacy_youtube_url ? "migration_required" : "none"),
    uploadState: media?.upload_state ?? null,
    originalUrl: legacyId ? `https://www.youtube.com/watch?v=${legacyId}` : null,
  };
}

async function getMedia(id: string) {
  const { data, error } = await createAdminClient().from("lesson_media").select(mediaColumns).eq("lesson_id", id).maybeSingle();
  if (error) throw error;
  return data as LessonMedia | null;
}

function refreshLesson(id: string) {
  revalidatePath("/");
  revalidatePath(`/lessons/${id}`);
  revalidatePath(`/lessons/${id}/edit`);
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const access = await authorizeLessonMedia(id, true);
  if (access.error) return access.error;
  try {
    const media = await getMedia(id);
    if (!media?.upload_id || media.upload_state === "failed") return mediaResponse(summarize(media));
    const deadline = Date.parse(media.upload_expires_at ?? "");
    const next = { ...media };
    if (media.pending_uid) {
      let video;
      try {
        video = await getStreamVideo(media.pending_uid);
      } catch (error) {
        if (!(error instanceof StreamError) || error.status !== 404 || deadline > Date.now()) throw error;
      }
      const state = video?.status?.state;
      if (video?.readyToStream && state === "ready") {
        await ensurePrivateStream(video);
        Object.assign(next, clearUpload, { stream_uid: video.uid });
      } else if (state === "error" || ((!state || state === "pendingupload") && deadline <= Date.now())) {
        next.upload_state = "failed";
        next.upload_url = null;
      } else if (state && state !== "pendingupload") {
        next.upload_state = "processing";
        next.upload_url = null;
      }
    } else if (Date.now() > deadline - uploadLifetime + reservationTimeout) {
      next.upload_state = "failed";
    }
    if (next.upload_state === media.upload_state && next.stream_uid === media.stream_uid) return mediaResponse(summarize(media));
    const { data, error } = await createAdminClient().from("lesson_media").update({
      stream_uid: next.stream_uid, pending_uid: next.pending_uid, upload_id: next.upload_id,
      upload_url: next.upload_url, upload_fingerprint: next.upload_fingerprint,
      upload_expires_at: next.upload_expires_at, upload_state: next.upload_state,
    }).eq("lesson_id", id).eq("upload_id", media.upload_id).eq("upload_state", media.upload_state!)
      .select(mediaColumns).maybeSingle();
    if (error) throw error;
    if (data) refreshLesson(id);
    return mediaResponse(summarize((data as LessonMedia | null) ?? await getMedia(id)));
  } catch {
    return mediaResponse({ error: "Não foi possível consultar o estado do vídeo. Tente novamente." }, 503);
  }
}

export async function POST(request: Request, { params }: Context) {
  if (!sameRequestOrigin(request)) return mediaResponse({ error: "Solicitação inválida." }, 403);
  const { id } = await params;
  const access = await authorizeLessonMedia(id, true);
  if (access.error) return access.error;
  const input = uploadInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return mediaResponse({ error: "Selecione um arquivo válido de até 30 GB." }, 400);

  const { size, fingerprint } = input.data;
  const reservation = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + uploadLifetime).toISOString();
  let reserved = false;
  let providerUid: string | null = null;
  try {
    const admin = createAdminClient();
    const { error: initializeError } = await admin.from("lesson_media").upsert({ lesson_id: id }, {
      onConflict: "lesson_id", ignoreDuplicates: true,
    });
    if (initializeError) throw initializeError;
    const current = await getMedia(id);
    if (!current) throw new Error("Gravação indisponível.");
    if (current.upload_state && current.upload_state !== "failed") {
      if (current.upload_state === "uploading" && current.upload_url && current.upload_fingerprint === fingerprint
        && Date.parse(current.upload_expires_at ?? "") > Date.now()) {
        return mediaResponse({ uploadUrl: current.upload_url, ...summarize(current) });
      }
      return mediaResponse({ error: "Aguarde ou cancele o envio em andamento para escolher outro arquivo." }, 409);
    }
    let lock = admin.from("lesson_media").update({
      ...clearUpload, upload_id: reservation, upload_state: "uploading",
      upload_fingerprint: fingerprint, upload_expires_at: expiresAt,
    }).eq("lesson_id", id);
    lock = current.upload_id ? lock.eq("upload_id", current.upload_id).eq("upload_state", "failed") : lock.is("upload_id", null);
    const { data: reservationData, error: reservationError } = await lock.select("upload_id").maybeSingle();
    if (reservationError) throw reservationError;
    if (!reservationData) return mediaResponse({ error: "Já existe uma operação de vídeo para esta aula. Atualize e tente novamente." }, 409);
    reserved = true;

    const provider = await createStreamUpload(size, access.lesson.title, expiresAt);
    providerUid = provider.uid;
    const { data, error } = await admin.from("lesson_media").update({ pending_uid: provider.uid, upload_url: provider.url })
      .eq("lesson_id", id).eq("upload_id", reservation).eq("upload_state", "uploading").select(mediaColumns).maybeSingle();
    if (error) throw error;
    if (!data) {
      await discardStreamUpload(provider.uid);
      return mediaResponse({ error: "O envio foi cancelado." }, 409);
    }
    refreshLesson(id);
    return mediaResponse({ uploadUrl: provider.url, ...summarize(data as LessonMedia) });
  } catch (error) {
    if (reserved) {
      const { data } = await createAdminClient().from("lesson_media").update({ upload_state: "failed", upload_url: null })
        .eq("lesson_id", id).eq("upload_id", reservation).eq("upload_state", "uploading").is("pending_uid", null)
        .select("upload_id").maybeSingle();
      if (data && providerUid) await discardStreamUpload(providerUid);
      refreshLesson(id);
    }
    return mediaResponse({ error: error instanceof StreamError && error.status === 503
      ? "O serviço de vídeo ainda não está configurado nesta instalação."
      : "Não foi possível iniciar o envio. Tente novamente." }, 503);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!sameRequestOrigin(request)) return mediaResponse({ error: "Solicitação inválida." }, 403);
  const { id } = await params;
  const access = await authorizeLessonMedia(id, true);
  if (access.error) return access.error;
  try {
    const media = await getMedia(id);
    if (!media?.upload_id) return mediaResponse(summarize(media));
    const { data, error } = await createAdminClient().from("lesson_media").update(clearUpload)
      .eq("lesson_id", id).eq("upload_id", media.upload_id).select(mediaColumns).maybeSingle();
    if (error) throw error;
    if (data && media.pending_uid) await discardStreamUpload(media.pending_uid);
    if (data) refreshLesson(id);
    return mediaResponse(summarize((data as LessonMedia | null) ?? await getMedia(id)));
  } catch {
    return mediaResponse({ error: "Não foi possível cancelar o envio. Tente novamente." }, 503);
  }
}
