"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReplyAction, deleteThreadAction } from "@/app/actions/community";

export function DeleteCommunityPostButton({
  kind,
  id,
  threadId,
  label = "Excluir",
}: {
  kind: "thread" | "reply";
  id: string;
  threadId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="post-action">
      <button
        type="button"
        className="button danger small"
        disabled={pending}
        onClick={() => {
          const message =
            kind === "thread"
              ? "Excluir esta dúvida? As respostas e os anexos também serão apagados."
              : "Excluir esta resposta?";
          if (!window.confirm(message)) return;
          startTransition(async () => {
            setError("");
            const result =
              kind === "thread"
                ? await deleteThreadAction(id)
                : await deleteReplyAction(threadId ?? "", id);
            if (!result.ok) {
              setError(result.message ?? "Não foi possível excluir.");
              return;
            }
            if (kind === "thread") {
              router.push("/comunidade");
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Excluindo…" : label}
      </button>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </span>
  );
}
