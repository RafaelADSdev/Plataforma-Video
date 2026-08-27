import { getAuthContext } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { isStorageBucket } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const auth = await getAuthContext();
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const { bucket, path } = await params;
  if (!isStorageBucket(bucket) || !path?.length) {
    return Response.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const storagePath = path.join("/");
  const supabase = await createClient();
  let data: Blob | null = null;
  const downloaded = await supabase.storage.from(bucket).download(storagePath);
  if (!downloaded.error && downloaded.data) {
    data = downloaded.data;
  } else if (bucket === "feedback") {
    const studentId = path[0];
    if (!postgresUuidSchema().safeParse(studentId).success) {
      return Response.json({ error: "Arquivo inválido." }, { status: 400 });
    }
    if (!auth.isStaff && auth.id !== studentId) {
      return Response.json({ error: "Arquivo não encontrado ou sem permissão." }, { status: 404 });
    }
    const admin = createAdminClient();
    const privileged = await admin.storage.from("feedback").download(storagePath);
    if (!privileged.error && privileged.data) data = privileged.data;
  }
  if (!data) return Response.json({ error: "Arquivo não encontrado ou sem permissão." }, { status: 404 });

  const requestedName = new URL(request.url).searchParams.get("nome");
  const fallbackName = path.at(-1) ?? "arquivo";
  const fileName = (requestedName || fallbackName).replace(/[\r\n"\\]/g, "-");
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Length": String(data.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
