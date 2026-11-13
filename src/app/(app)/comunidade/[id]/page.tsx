import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { createReplyAction } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { CommunityAttachments } from "@/components/community-attachments";
import { CommunityLikeButton } from "@/components/community-like-button";
import { CommunityReplyManage } from "@/components/community-reply-manage";
import { CommunityThreadManage } from "@/components/community-thread-manage";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/auth";
import { canDeleteCommunityPost, canEditCommunityPost } from "@/lib/community-permissions";
import { communityThreadFields, type ThreadWithLikes } from "@/lib/community-threads";
import { publicDisplayName } from "@/lib/profile-name";
import { formatDateTimeInSaoPaulo } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { CommunityThreadAttachment, Profile, Reply } from "@/types/domain";

export const metadata: Metadata = { title: "Dúvida" };

export default async function CommunityThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: threadData, error: threadError }, { data: repliesData }, { data: attachmentData }] = await Promise.all([
    supabase.from("community_threads").select(communityThreadFields).eq("id", id).maybeSingle(),
    supabase.from("community_replies").select("id,thread_id,author_id,body,is_staff,created_at").eq("thread_id", id).order("created_at"),
    supabase.from("community_thread_attachments").select("id,thread_id,author_id,storage_path,file_name,mime_type,size_bytes,created_at").eq("thread_id", id).order("created_at"),
  ]);
  if (threadError && threadError.code !== "22P02") throw new Error("Não foi possível carregar a dúvida.");
  if (!threadData) notFound();
  const thread = threadData as ThreadWithLikes;
  const replies = (repliesData ?? []) as Reply[];
  const attachments = (attachmentData ?? []) as CommunityThreadAttachment[];
  const ids = [...new Set([thread.author_id, ...replies.map((reply) => reply.author_id)])];
  const { data: profilesData } = await supabase.from("profiles").select("id,display_name,bio,avatar_path").in("id", ids);
  const profiles = new Map(((profilesData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const orderedReplies = [...replies].sort((a, b) => Number(b.is_staff) - Number(a.is_staff) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const author = profiles.get(thread.author_id);
  const authorName = publicDisplayName(author?.display_name);

  return (
    <main className="container page thread-page">
      <div className="lesson-breadcrumb"><Link href="/comunidade">Comunidade</Link><span aria-hidden="true">/</span><span>Dúvida</span></div>
      <article className="thread-question">
        <div className="meta thread-meta">
          <UserAvatar name={authorName} avatarPath={author?.avatar_path} size={32} />
          <span>{authorName} · {formatDateTimeInSaoPaulo(thread.created_at)}</span>
        </div>
        <CommunityThreadManage
          threadId={thread.id}
          title={thread.title}
          body={thread.body}
          canEdit={canEditCommunityPost(auth, thread.author_id)}
          canDelete={canDeleteCommunityPost(auth, thread.author_id)}
        />
        <CommunityAttachments attachments={attachments} />
        <CommunityLikeButton
          threadId={thread.id}
          title={thread.title}
          count={thread.like_count}
          liked={thread.my_like.length > 0}
          showLabel
        />
      </article>

      <section aria-labelledby="replies-title" className="replies-section">
        <div className="section-heading"><div><h2 id="replies-title">Respostas</h2><p className="muted">Respostas da equipe aparecem primeiro.</p></div></div>
        {orderedReplies.length === 0 ? (
          <EmptyState title="Ainda não há respostas"><p>Envie uma resposta para ajudar a continuar a conversa.</p></EmptyState>
        ) : (
          <ol className="reply-list">
            {orderedReplies.map((reply) => {
              const replyAuthor = profiles.get(reply.author_id);
              const replyName = publicDisplayName(replyAuthor?.display_name);
              return (
                <li key={reply.id} className={reply.is_staff ? "staff-reply" : ""}>
                  <div className="reply-heading">
                    <UserAvatar name={replyName} avatarPath={replyAuthor?.avatar_path} size={28} />
                    <strong>{replyName}</strong>
                    {reply.is_staff ? <span className="badge primary"><BadgeCheck aria-hidden="true" size={14} /> Resposta do professor</span> : null}
                    <span>{formatDateTimeInSaoPaulo(reply.created_at)}</span>
                  </div>
                  <CommunityReplyManage
                    threadId={thread.id}
                    replyId={reply.id}
                    body={reply.body}
                    canEdit={canEditCommunityPost(auth, reply.author_id)}
                    canDelete={canDeleteCommunityPost(auth, reply.author_id)}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="panel reply-form" aria-labelledby="reply-form-title">
        <h2 id="reply-form-title">Responder</h2>
        <ActionForm action={createReplyAction.bind(null, thread.id)} submitLabel="Enviar resposta" pendingLabel="Enviando…">
          <div className="field"><label htmlFor="reply-body">Sua resposta</label><textarea className="textarea" id="reply-body" name="body" required maxLength={8000} /></div>
        </ActionForm>
      </section>
    </main>
  );
}
