"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateThreadAction } from "@/app/actions/community";
import { DeleteCommunityPostButton } from "@/components/delete-community-post-button";
import { initialActionState, type ActionState } from "@/lib/action-state";

export function CommunityThreadManage({
  threadId,
  title,
  body,
  canEdit,
  canDelete,
}: {
  threadId: string;
  title: string;
  body: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const bound = updateThreadAction.bind(null, threadId);

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
      <form action={formAction} className="form-grid thread-edit-form">
        <div className="field">
          <label htmlFor="edit-thread-title">Título</label>
          <input className="input" id="edit-thread-title" name="title" defaultValue={title} required minLength={4} maxLength={160} />
          {state.fieldErrors?.title ? <p className="field-error">{state.fieldErrors.title}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="edit-thread-body">Dúvida</label>
          <textarea className="textarea" id="edit-thread-body" name="body" defaultValue={body} required minLength={8} maxLength={8000} />
          {state.fieldErrors?.body ? <p className="field-error">{state.fieldErrors.body}</p> : null}
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
      <h1>{title}</h1>
      <div className="reading">{body}</div>
      {canEdit || canDelete ? (
        <div className="post-actions">
          {canEdit ? (
            <button className="button secondary small" type="button" onClick={() => setEditing(true)}>
              Editar texto
            </button>
          ) : null}
          {canDelete ? <DeleteCommunityPostButton kind="thread" id={threadId} /> : null}
        </div>
      ) : null}
    </>
  );
}
