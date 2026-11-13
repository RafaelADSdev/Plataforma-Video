import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  lessonId: postgresUuidSchema(),
  lastSeconds: z.number().finite().min(0).max(24 * 60 * 60),
  watched: z.boolean().optional(),
  manual: z.boolean().optional(),
  playback: z.object({
    durationMs: z.number().int().min(1).max(86_400_000),
    ranges: z.array(z.object({
      start_ms: z.number().int().min(0).max(86_400_000),
      end_ms: z.number().int().min(1).max(86_400_000),
    })).max(256),
  }).optional(),
});

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (auth.role !== "aluno") return Response.json({ error: "Progresso disponível apenas para alunos." }, { status: 403 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Dados de progresso inválidos." }, { status: 400 });

  const supabase = await createClient();
  const { data: watched, error } = await supabase.rpc("save_lesson_progress", {
    p_lesson_id: parsed.data.lessonId,
    p_seconds: Math.floor(parsed.data.lastSeconds),
    p_watched: Boolean(parsed.data.watched),
    p_manual: Boolean(parsed.data.manual),
    p_duration_ms: parsed.data.playback?.durationMs,
    p_played_ms: parsed.data.playback?.ranges,
  });
  if (error) return Response.json({ error: "Não foi possível salvar o progresso." }, { status: error.code === "42501" ? 404 : 500 });
  return Response.json({ watched });
}
