import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleQuestion, Paperclip } from "lucide-react";
import { CommunityLikeButton } from "@/components/community-like-button";
import { CommunityThreadForm } from "@/components/community-thread-form";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/auth";
import { communityThreadFields, type ThreadWithLikes } from "@/lib/community-threads";
import { publicDisplayName } from "@/lib/profile-name";
import { formatDateTimeInSaoPaulo } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Course, Profile } from "@/types/domain";

export const metadata: Metadata = { title: "Comunidade" };

const orderOptions = [
  { value: "curtidas", label: "Mais curtidas", href: "/comunidade" },
  { value: "recentes", label: "Mais recentes", href: "/comunidade?ordem=recentes" },
  { value: "antigas", label: "Mais antigas", href: "/comunidade?ordem=antigas" },
] as const;

export default async function CommunityPage({ searchParams }: {
  searchParams: Promise<{ ordem?: string | string[] }>;
}) {
  await requireUser();
  const { ordem } = await searchParams;
  const order = orderOptions.find((option) => option.value === ordem) ?? orderOptions[0];
  const supabase = await createClient();
  const threadsQuery = supabase.from("community_threads").select(communityThreadFields);
  if (order.value === "curtidas") threadsQuery.order("like_count", { ascending: false });
  const [{ data: courseData }, { data: threadsData, error: threadsError }] = await Promise.all([
    supabase.from("courses").select("id,title,description,cover_path").limit(1).maybeSingle(),
    threadsQuery.order("created_at", { ascending: order.value === "antigas" }).order("id"),
  ]);
  const course = courseData as Course | null;
  const threads = (threadsData ?? []) as ThreadWithLikes[];
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
      <div className="page-header community-header">
        <div>
          <h1>Comunidade</h1>
          <p className="page-description">Faça perguntas sobre o curso e acompanhe as respostas do professor e da turma.</p>
        </div>
        {course ? <CommunityThreadForm courseId={course.id} /> : null}
      </div>
      {!course ? <p className="form-message community-notice">O curso ainda não foi configurado.</p> : null}

      <section aria-labelledby="thread-list-title">
        <div className="section-heading community-list-heading">
          <h2 id="thread-list-title">Dúvidas da turma</h2>
          <nav className="community-order" aria-label="Ordenar dúvidas">
            {orderOptions.map((option) => (
              <Link className="button small ghost" key={option.value} href={option.href} aria-current={order === option ? "page" : undefined}>
                {option.label}
              </Link>
            ))}
          </nav>
        </div>
        {threadsError ? (
          <EmptyState title="Não foi possível carregar as dúvidas">
            <p>Tente novamente em instantes.</p>
          </EmptyState>
        ) : threads.length === 0 ? (
          <EmptyState title="A comunidade ainda está vazia">
            {course ? <p>Publique a primeira dúvida para começar a conversa.</p> : null}
          </EmptyState>
        ) : (
          <ol className="thread-list">
            {threads.map((thread) => {
              const profile = profiles.get(thread.author_id);
              const authorName = publicDisplayName(profile?.display_name);
              const files = attachmentCount.get(thread.id) ?? 0;
              return (
                <li key={thread.id}>
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
                  <CommunityLikeButton
                    threadId={thread.id}
                    title={thread.title}
                    count={thread.like_count}
                    liked={thread.my_like.length > 0}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
