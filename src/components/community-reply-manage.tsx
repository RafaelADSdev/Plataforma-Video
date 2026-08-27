"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateReplyAction } from "@/app/actions/community";
import { DeleteCommunityPostButton } from "@/components/delete-community-post-button";
import { initialActionState, type ActionState } from "@/lib/action-state";

export function CommunityReplyManage({
  threadId,
  replyId,
  body,
  canEdit,
  canDelete,
}: {
  threadId: string;
  replyId: string;
  body: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const bound = updateReplyAction.bind(null, threadId, replyId);

  const action = async (state: ActionState, formData: FormData): Promise<ActionState> => {
    const result = await bound(state, formData);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    }
    return result;
  };

  const [state, formAction, pending] = useActionState(action, initialActionState);

  if (editing && canEdit) {
    return (
      <form action={formAction} className="form-grid reply-edit-form">
        <div className="field">
          <label htmlFor={`edit-reply-${replyId}`}>Resposta</label>
          <textarea className="textarea" id={`edit-reply-${replyId}`} name="body" defaultValue={body} required maxLength={8000} />
        </div>
        {state.message ? (
          <p className={`form-message${state.ok ? " form-success" : ""}`} role={state.ok ? "status" : "alert"}>
            {state.message}
          </p>
        ) : null}
        <div className="post-actions">
          <button className="button small" type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar texto"}
          </button>
          <button className="button secondary small" type="button" onClick={() => setEditing(false)} disabled={pending}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <p>{body}</p>
      {canEdit || canDelete ? (
        <div className="post-actions">
          {canEdit ? (
            <button className="button secondary small" type="button" onClick={() => setEditing(true)}>
              Editar texto
            </button>
          ) : null}
          {canDelete ? <DeleteCommunityPostButton kind="reply" id={replyId} threadId={threadId} /> : null}
        </div>
      ) : null}
    </>
  );
}
