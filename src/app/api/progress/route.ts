import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  lessonId: postgresUuidSchema(),
  lastSeconds: z.number().finite().min(0).max(24 * 60 * 60),
  watched: z.boolean().optional(),
  manual: z.boolean().optional(),
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
  const { data: current } = await supabase
    .from("lesson_progress")
    .select("watched")
    .eq("lesson_id", parsed.data.lessonId)
    .eq("user_id", auth.id)
    .maybeSingle();
  const watched = parsed.data.manual
    ? Boolean(parsed.data.watched)
    : Boolean(current?.watched || parsed.data.watched);
  const { error } = await supabase.from("lesson_progress").upsert({
    lesson_id: parsed.data.lessonId,
    user_id: auth.id,
    last_seconds: Math.floor(parsed.data.lastSeconds),
    watched,
    updated_at: new Date().toISOString(),
  }, { onConflict: "lesson_id,user_id" });

  if (error) return Response.json({ error: "Não foi possível salvar o progresso." }, { status: 500 });
  return Response.json({ watched });
}
