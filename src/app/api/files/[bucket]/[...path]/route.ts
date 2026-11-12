import { getAuthContext } from "@/lib/auth";
import { isStorageBucket } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const auth = await getAuthContext();
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const { bucket, path } = await params;
  if (!isStorageBucket(bucket) || !path?.length || path.some((part) => !part || part === "." || part === ".." || /[/\\]/.test(part))) {
    return Response.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const storagePath = path.join("/");
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) return Response.json({ error: "Arquivo não encontrado ou sem permissão." }, { status: 404 });

  const requestedName = new URL(request.url).searchParams.get("nome");
  const fallbackName = path.at(-1) ?? "arquivo";
  const fileName = (requestedName || fallbackName).replace(/[\r\n"\\]/g, "-");
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Length": String(data.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
