import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleQuestion, Paperclip } from "lucide-react";
import { CommunityThreadForm } from "@/components/community-thread-form";
import { DeleteCommunityPostButton } from "@/components/delete-community-post-button";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/auth";
import { canDeleteCommunityPost } from "@/lib/community-permissions";
import { publicDisplayName } from "@/lib/profile-name";
import { formatDateTimeInSaoPaulo } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Course, Profile, Thread } from "@/types/domain";

export const metadata: Metadata = { title: "Comunidade" };

export default async function CommunityPage() {
  const auth = await requireUser();
  const supabase = await createClient();
  const [{ data: courseData }, { data: threadsData }] = await Promise.all([
    supabase.from("courses").select("id,title,description,cover_path").limit(1).maybeSingle(),
    supabase.from("community_threads").select("id,course_id,author_id,title,body,created_at").order("created_at", { ascending: false }),
  ]);
  const course = courseData as Course | null;
  const threads = (threadsData ?? []) as Thread[];
  const authorIds = [...new Set(threads.map((thread) => thread.author_id))];
  const threadIds = threads.map((thread) => thread.id);
  const [{ data: profileData }, { data: attachmentData }] = await Promise.all([
    authorIds.length
      ? supabase.from("profiles").select("id,display_name,bio,avatar_path").in("id", authorIds)
      : Promise.resolve({ data: [] as Profile[] }),
    threadIds.length
      ? supabase.from("community_thread_attachments").select("id,thread_id").in("thread_id", threadIds)
      : Promise.resolve({ data: [] as { id: string; thread_id: string }[] }),
  ]);
  const profiles = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const attachmentCount = new Map<string, number>();
  for (const attachment of attachmentData ?? []) {
    attachmentCount.set(attachment.thread_id, (attachmentCount.get(attachment.thread_id) ?? 0) + 1);
  }

  return (
    <main className="container page">
      <div className="page-header"><div><h1>Comunidade</h1><p className="page-description">Faça perguntas sobre o curso e acompanhe as respostas do professor e da turma.</p></div></div>
      <div className="community-layout">
        <section aria-labelledby="thread-list-title">
          <div className="section-heading"><div><h2 id="thread-list-title">Dúvidas da turma</h2><p className="muted">Mais recentes primeiro.</p></div></div>
          {threads.length === 0 ? (
            <EmptyState title="A comunidade ainda está vazia"><p>Publique a primeira dúvida para começar a conversa.</p></EmptyState>
          ) : (
            <ol className="thread-list">
              {threads.map((thread) => {
                const profile = profiles.get(thread.author_id);
                const authorName = publicDisplayName(profile?.display_name);
                const files = attachmentCount.get(thread.id) ?? 0;
                const showDelete = canDeleteCommunityPost(auth, thread.author_id);
                return (
                  <li key={thread.id}>
                    <div className={showDelete ? "thread-card has-actions" : "thread-card"}>
                      <Link href={`/comunidade/${thread.id}`}>
                        <MessageCircleQuestion aria-hidden="true" size={21} />
                        <span>
                          <strong>{thread.title}</strong>
                          <small className="thread-author">
                            <UserAvatar name={authorName} avatarPath={profile?.avatar_path} size={28} />
                            <span>{authorName} · {formatDateTimeInSaoPaulo(thread.created_at)}</span>
                          </small>
                          <span className="thread-excerpt">{thread.body}</span>
                          {files > 0 ? (
                            <span className="thread-attachment-count">
                              <Paperclip aria-hidden="true" size={14} />
                              {files === 1 ? "1 anexo" : `${files} anexos`}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                      {showDelete ? (
                        <div className="thread-card-actions">
                          <DeleteCommunityPostButton kind="thread" id={thread.id} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="panel new-thread-panel" aria-labelledby="new-thread-title">
          <h2 id="new-thread-title">Nova dúvida</h2>
          <p className="muted">Dê contexto suficiente para a turma ajudar.</p>
          {course ? (
            <CommunityThreadForm courseId={course.id} />
          ) : <p className="form-message">O curso ainda não foi configurado.</p>}
        </aside>
      </div>
    </main>
  );
}
