import { authorizeLessonMedia, mediaResponse, sameRequestOrigin } from "@/lib/lesson-media";
import { createStreamPlayback } from "@/lib/stream-token";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameRequestOrigin(request)) return mediaResponse({ error: "Solicitação inválida." }, 403);
  const { id } = await params;
  const access = await authorizeLessonMedia(id);
  if (access.error) return access.error;
  if (access.lesson.video_status !== "ready") return mediaResponse({ error: "O vídeo ainda não está disponível." }, 404);
  try {
    const { data, error } = await createAdminClient().from("lesson_media").select("stream_uid").eq("lesson_id", id).maybeSingle();
    if (error) throw error;
    if (!data?.stream_uid) return mediaResponse({ error: "O vídeo ainda não está disponível." }, 404);
    return mediaResponse(createStreamPlayback(
      data.stream_uid,
      process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "",
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID ?? "",
      process.env.CLOUDFLARE_STREAM_SIGNING_JWK ?? "",
    ));
  } catch {
    return mediaResponse({ error: "Não foi possível liberar o vídeo. Tente novamente." }, 503);
  }
}
