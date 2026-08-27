"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Salvando…",
  className = "form-grid",
  fieldLabels = {},
  noValidate = false,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  fieldLabels?: Record<string, string>;
  noValidate?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const fieldErrors = Object.entries(state.fieldErrors ?? {}).filter(([, message]) => message);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && state.ok) formRef.current?.reset();
    wasPendingRef.current = pending;
  }, [pending, state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      noValidate={noValidate}
      onSubmit={(event) => {
        if (!noValidate && !event.currentTarget.checkValidity()) return;
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state.message || fieldErrors.length > 0 ? (
        <div
          className={`form-message${state.ok ? " form-success" : ""}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message ? <p>{state.message}</p> : null}
          {fieldErrors.length > 0 ? (
            <ul>
              {fieldErrors.map(([field, message]) => (
                <li key={field}><strong>{fieldLabels[field] ?? field.replaceAll("_", " ")}:</strong> {message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
