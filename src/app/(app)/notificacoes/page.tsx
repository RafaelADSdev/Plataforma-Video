import type { Metadata } from "next";
import { Bell, CheckCircle2, MessageCircle, MessageCircleQuestion, Send } from "lucide-react";
import { openNotificationAction } from "@/app/actions/notifications";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { formatDateTimeInSaoPaulo } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, Notification, Thread } from "@/types/domain";

export const metadata: Metadata = { title: "Notificações" };

const typeInfo = {
  comment: { label: "Novo comentário", Icon: Bell },
  community: { label: "Nova dúvida na comunidade", Icon: MessageCircleQuestion },
  submission: { label: "Nova entrega", Icon: Send },
  feedback: { label: "Mensagem na entrega", Icon: MessageCircle },
};

export default async function NotificationsPage() {
  const auth = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,recipient_id,type,lesson_id,thread_id,comment_id,submission_id,read_at,created_at")
    .eq("recipient_id", auth.id)
    .order("created_at", { ascending: false });
  const notifications = (data ?? []) as Notification[];
  const lessonIds = [...new Set(notifications.flatMap((item) => item.lesson_id ? [item.lesson_id] : []))];
  const threadIds = [...new Set(notifications.flatMap((item) => item.thread_id ? [item.thread_id] : []))];
  const submissionIds = [...new Set(notifications.flatMap((item) => item.submission_id ? [item.submission_id] : []))];
  const [{ data: lessonsData }, { data: threadsData }, { data: submissionsData }] = await Promise.all([
    lessonIds.length ? supabase.from("lessons").select("id,title").in("id", lessonIds) : Promise.resolve({ data: [] }),
    threadIds.length ? supabase.from("community_threads").select("id,title").in("id", threadIds) : Promise.resolve({ data: [] }),
    submissionIds.length ? supabase.from("submissions").select("id,activities(title)").in("id", submissionIds) : Promise.resolve({ data: [] }),
  ]);
  const lessons = new Map(((lessonsData ?? []) as Pick<Lesson, "id" | "title">[]).map((item) => [item.id, item.title]));
  const threads = new Map(((threadsData ?? []) as Pick<Thread, "id" | "title">[]).map((item) => [item.id, item.title]));
  const submissions = new Map(((submissionsData ?? []) as unknown as { id: string; activities: { title: string } | null }[])
    .map((item) => [item.id, item.activities?.title]));

  return (
    <main className="container page notifications-page">
      <div className="page-header"><div><h1>Notificações</h1><p className="page-description">{auth.isStaff ? "Acompanhe comentários, dúvidas, entregas e mensagens." : "Acompanhe as respostas dos professores nas suas entregas."}</p></div></div>
      {notifications.length === 0 ? (
        <EmptyState title="Você não tem notificações"><p>{auth.isStaff ? "A atividade da turma aparecerá aqui." : "As respostas nas suas entregas aparecerão aqui."}</p></EmptyState>
      ) : (
        <ol className="notification-list">
          {notifications.map((notification) => {
            const { Icon, label } = typeInfo[notification.type];
            const target = notification.thread_id
              ? threads.get(notification.thread_id)
              : notification.lesson_id ? lessons.get(notification.lesson_id) : null;
            const targetTitle = (notification.submission_id ? submissions.get(notification.submission_id) : undefined) ?? target;
            return (
              <li key={notification.id} className={notification.read_at ? "read" : "unread"}>
                <div className="notification-icon"><Icon aria-hidden="true" size={19} /></div>
                <div><strong>{label}</strong>{targetTitle ? <span>{targetTitle}</span> : null}<time dateTime={notification.created_at}>{formatDateTimeInSaoPaulo(notification.created_at)}</time></div>
                {notification.read_at ? <span className="read-label"><CheckCircle2 aria-hidden="true" size={15} /> Lida</span> : null}
                <form action={openNotificationAction.bind(null, notification.id)}><button className="button secondary small" type="submit">Abrir</button></form>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
