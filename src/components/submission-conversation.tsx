"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, MessageCircle, X } from "lucide-react";
import { SubmissionMessageForm } from "@/components/submission-message-form";
import { UserAvatar } from "@/components/user-avatar";
import { publicDisplayName } from "@/lib/profile-name";
import { storageFileUrl } from "@/lib/storage";
import { formatDateTimeInSaoPaulo } from "@/lib/time";
import type { SubmissionMessage } from "@/types/domain";

const subscribeToClient = () => () => {};

export function SubmissionConversationDialog({
  lessonId,
  studentId,
  isStaff,
  studentName,
  fileName,
  fileHref,
  messages,
  open,
}: {
  lessonId: string;
  studentId: string;
  isStaff: boolean;
  studentName: string;
  fileName: string;
  fileHref: string;
  messages: SubmissionMessage[];
  open: boolean;
}) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const messagesEndRef = useRef<HTMLLIElement>(null);
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [isOpen, setIsOpen] = useState(open);
  const titleId = useId();
  const title = isStaff ? `Conversa com ${studentName}` : "Conversa com o professor";
  const triggerLabel = isStaff
    ? messages.length > 0 ? "Ver conversa" : "Responder"
    : messages.length > 0 ? "Ver conversa" : "Conversar com o professor";

  function conversationUrl(nextOpen: boolean) {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    if (nextOpen) params.set("conversa", studentId);
    else params.delete("conversa");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function syncConversationUrl(nextOpen: boolean) {
    window.history.replaceState(null, "", conversationUrl(nextOpen));
  }

  function openDialog() {
    setIsOpen(true);
    syncConversationUrl(true);
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    setIsOpen(false);
    syncConversationUrl(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [mounted, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, messages.length]);

  const dialog = (
      <dialog
        ref={dialogRef}
        className="submission-dialog"
        aria-labelledby={titleId}
        onClose={() => {
          setIsOpen(false);
          syncConversationUrl(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="submission-dialog-shell">
          <header className="submission-dialog-header">
            <div>
              <p className="submission-dialog-kicker">Entrega</p>
              <h2 id={titleId}>{title}</h2>
              <p className="submission-dialog-file">
                <span>{isStaff ? studentName : "Seu envio"} · {fileName}</span>
                <Link className="button secondary small" href={fileHref} target="_blank" rel="noreferrer">
                  <Download aria-hidden="true" size={16} /> Abrir arquivo
                </Link>
              </p>
            </div>
            <button className="icon-button" type="button" aria-label="Fechar conversa" onClick={closeDialog}>
              <X aria-hidden="true" size={18} />
            </button>
          </header>
          <div className="submission-dialog-body">
            {messages.length === 0 ? (
              <p className="muted">
                {isStaff
                  ? "Envie a atividade corrigida ou tire dúvidas desta entrega em privado."
                  : "O professor responde aqui com a correção e você pode tirar dúvidas desta entrega em privado."}
              </p>
            ) : (
              <ol className="submission-messages">
                {messages.map((item, index) => {
                  const authorName = publicDisplayName(
                    item.profiles?.display_name,
                    item.author_id === studentId ? studentName : "Professor",
                  );
                  const fromStaff = item.author_id !== studentId;
                  const fileUrl = storageFileUrl("feedback", item.storage_path);
                  return (
                    <li
                      key={item.id}
                      ref={index === messages.length - 1 ? messagesEndRef : undefined}
                      className={fromStaff ? "from-staff" : undefined}
                    >
                      <div className="submission-message-meta">
                        <UserAvatar name={authorName} avatarPath={item.profiles?.avatar_path} size={28} />
                        <strong>{authorName}</strong>
                        <time dateTime={item.created_at}>{formatDateTimeInSaoPaulo(item.created_at)}</time>
                      </div>
                      {item.body.trim() ? <p>{item.body}</p> : null}
                      {fileUrl && item.file_name ? (
                        <Link
                          className="button secondary small"
                          href={`${fileUrl}?nome=${encodeURIComponent(item.file_name)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download aria-hidden="true" size={16} />
                          {item.file_name}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <div className="submission-dialog-form">
            <SubmissionMessageForm lessonId={lessonId} studentId={studentId} isStaff={isStaff} />
          </div>
        </div>
      </dialog>
  );

  return (
    <>
      <button className="button secondary small" type="button" onClick={openDialog}>
        <MessageCircle aria-hidden="true" size={16} />
        {triggerLabel}
      </button>
      {mounted && isOpen ? createPortal(dialog, document.body) : null}
    </>
  );
}
