"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { postgresUuidSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export async function openNotificationAction(notificationId: string) {
  const auth = await requireUser();
  if (!postgresUuidSchema().safeParse(notificationId).success) redirect("/notificacoes");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,recipient_id,type,lesson_id,thread_id,comment_id,submission_id,read_at,created_at")
    .eq("id", notificationId)
    .eq("recipient_id", auth.id)
    .maybeSingle();
  if (!data) redirect("/notificacoes");

  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("recipient_id", auth.id);
  revalidatePath("/notificacoes");
  if (data.thread_id) redirect(`/comunidade/${data.thread_id}`);
  if (data.lesson_id && data.submission_id) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("user_id")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (submission?.user_id) redirect(`/lessons/${data.lesson_id}?conversa=${submission.user_id}`);
  }
  if (data.lesson_id) redirect(`/lessons/${data.lesson_id}`);
  redirect("/notificacoes");
}
