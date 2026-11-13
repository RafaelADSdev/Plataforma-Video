"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { canDeleteCommunityPost, canEditCommunityPost } from "@/lib/community-permissions";
import { postgresUuidSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ThreadActionState = ActionState & { threadId?: string };

export async function setThreadLikeAction(
  threadId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(threadId).success) return actionError("Dúvida inválida.");

  const liked = formData.get("liked");
  if (liked !== "true" && liked !== "false") return actionError("Curtida inválida.");

  const supabase = await createClient();
  const likes = supabase.from("community_thread_likes");
  const { error } = liked === "true"
    ? await likes.upsert({ thread_id: threadId, user_id: auth.id }, {
        onConflict: "thread_id,user_id",
        ignoreDuplicates: true,
      })
    : await likes.delete().eq("thread_id", threadId).eq("user_id", auth.id);

  if (error) return actionError("Não foi possível atualizar a curtida. Tente novamente.");

  revalidatePath("/comunidade");
  revalidatePath(`/comunidade/${threadId}`);
  return { ok: true };
}

export async function createThreadAction(
  _state: ThreadActionState,
  formData: FormData,
): Promise<ThreadActionState> {
  const auth = await requireUser();
  const parsed = z.object({
    course_id: postgresUuidSchema(),
    title: z.string().trim().min(4, "Resuma a dúvida no título.").max(160, "Use até 160 caracteres."),
    body: z.string().trim().min(8, "Explique um pouco mais a sua dúvida.").max(8_000, "Use até 8.000 caracteres."),
  }).safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os campos da dúvida.", {
      title: fields.title?.[0] ?? "",
      body: fields.body?.[0] ?? "",
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("community_threads").insert({
    ...parsed.data,
    author_id: auth.id,
  }).select("id").single();
  if (error || !data) return actionError("Não foi possível publicar a dúvida. Tente novamente.");

  revalidatePath("/comunidade");
  revalidatePath("/notificacoes");
  return { ok: true, message: "Dúvida publicada.", threadId: data.id };
}

export async function createReplyAction(
  threadId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(threadId).success) return actionError("Dúvida inválida.");
  const parsed = z.string().trim().min(1, "Escreva a resposta.").max(8_000, "Use até 8.000 caracteres.").safeParse(formData.get("body"));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Resposta inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("community_replies").insert({
    thread_id: threadId,
    author_id: auth.id,
    body: parsed.data,
  });
  if (error) return actionError("Não foi possível enviar a resposta. Tente novamente.");
  revalidatePath(`/comunidade/${threadId}`);
  return { ok: true, message: "Resposta publicada." };
}

const threadTextSchema = z.object({
  title: z.string().trim().min(4, "Resuma a dúvida no título.").max(160, "Use até 160 caracteres."),
  body: z.string().trim().min(8, "Explique um pouco mais a sua dúvida.").max(8_000, "Use até 8.000 caracteres."),
});

export async function updateThreadAction(
  threadId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(threadId).success) return actionError("Dúvida inválida.");
  const parsed = threadTextSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return actionError("Revise os campos da dúvida.", {
      title: fields.title?.[0] ?? "",
      body: fields.body?.[0] ?? "",
    });
  }

  const supabase = await createClient();
  const { data: thread, error: loadError } = await supabase
    .from("community_threads")
    .select("id,author_id")
    .eq("id", threadId)
    .maybeSingle();
  if (loadError || !thread) return actionError("Dúvida não encontrada.");
  if (!canEditCommunityPost(auth, thread.author_id)) {
    return actionError("Só o autor pode editar o texto desta dúvida.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_threads")
    .update(parsed.data)
    .eq("id", threadId)
    .eq("author_id", auth.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return actionError("Não foi possível salvar a dúvida. Tente novamente.");

  revalidatePath("/comunidade");
  revalidatePath(`/comunidade/${threadId}`);
  return { ok: true, message: "Dúvida atualizada." };
}

export async function deleteThreadAction(threadId: string): Promise<ActionState> {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(threadId).success) return actionError("Dúvida inválida.");

  const supabase = await createClient();
  const { data: thread, error: loadError } = await supabase
    .from("community_threads")
    .select("id,author_id")
    .eq("id", threadId)
    .maybeSingle();
  if (loadError || !thread) return actionError("Dúvida não encontrada.");
  if (!canDeleteCommunityPost(auth, thread.author_id)) {
    return actionError("Você só pode excluir as suas dúvidas.");
  }

  const { data: attachments } = await supabase
    .from("community_thread_attachments")
    .select("storage_path")
    .eq("thread_id", threadId);
  const paths = (attachments ?? []).map((file) => file.storage_path as string).filter(Boolean);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_threads")
    .delete()
    .eq("id", threadId)
    .select("id")
    .maybeSingle();
  if (error || !data) return actionError("Não foi possível excluir a dúvida.");

  if (paths.length > 0) {
    const removed = await admin.storage.from("community").remove(paths);
    if (removed.error) {
      // The post is already gone; leftover files should not block the user.
    }
  }

  revalidatePath("/comunidade");
  revalidatePath("/notificacoes");
  return { ok: true, message: "Dúvida excluída." };
}

export async function updateReplyAction(
  threadId: string,
  replyId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(threadId).success || !postgresUuidSchema().safeParse(replyId).success) {
    return actionError("Resposta inválida.");
  }
  const parsed = z.string().trim().min(1, "Escreva a resposta.").max(8_000, "Use até 8.000 caracteres.").safeParse(formData.get("body"));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Resposta inválida.");

  const supabase = await createClient();
  const { data: reply, error: loadError } = await supabase
    .from("community_replies")
    .select("id,author_id,thread_id")
    .eq("id", replyId)
    .eq("thread_id", threadId)
    .maybeSingle();
  if (loadError || !reply) return actionError("Resposta não encontrada.");
  if (!canEditCommunityPost(auth, reply.author_id)) {
    return actionError("Só o autor pode editar o texto desta resposta.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_replies")
    .update({ body: parsed.data })
    .eq("id", replyId)
    .eq("thread_id", threadId)
    .eq("author_id", auth.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return actionError("Não foi possível salvar a resposta. Tente novamente.");

  revalidatePath(`/comunidade/${threadId}`);
  return { ok: true, message: "Resposta atualizada." };
}

export async function deleteReplyAction(threadId: string, replyId: string): Promise<ActionState> {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(threadId).success || !postgresUuidSchema().safeParse(replyId).success) {
    return actionError("Resposta inválida.");
  }

  const supabase = await createClient();
  const { data: reply, error: loadError } = await supabase
    .from("community_replies")
    .select("id,author_id,thread_id")
    .eq("id", replyId)
    .eq("thread_id", threadId)
    .maybeSingle();
  if (loadError || !reply) return actionError("Resposta não encontrada.");
  if (!canDeleteCommunityPost(auth, reply.author_id)) {
    return actionError("Você só pode excluir as suas respostas.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_replies")
    .delete()
    .eq("id", replyId)
    .eq("thread_id", threadId)
    .select("id")
    .maybeSingle();
  if (error || !data) return actionError("Não foi possível excluir a resposta.");

  revalidatePath(`/comunidade/${threadId}`);
  return { ok: true, message: "Resposta excluída." };
}
