"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useTransition } from "react";
import { reorderModuleAction } from "@/app/actions/course";
import { reorderCourseItemAction } from "@/app/actions/activities";

type Props = {
  id: string;
  direction: "up" | "down";
  disabled?: boolean;
} & ({ kind: "module" } | { kind: "lesson" | "activity"; moduleId: string });

export function ReorderButton(props: Props) {
  const { kind, id, direction, disabled = false } = props;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const label = `${direction === "up" ? "Mover para cima" : "Mover para baixo"} ${kind === "module" ? "o módulo" : kind === "activity" ? "a atividade" : "a aula"}`;
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <span className="reorder-control">
      <button
        className="icon-button"
        type="button"
        aria-label={pending ? "Salvando nova ordem…" : label}
        title={label}
        disabled={disabled || pending}
        onClick={() => startTransition(async () => {
          setError("");
          const result = props.kind === "module"
            ? await reorderModuleAction(id, direction)
            : await reorderCourseItemAction(props.moduleId, id, props.kind, direction);
          if (!result.ok && result.message) setError(result.message);
        })}
      >
        <Icon aria-hidden="true" size={17} />
      </button>
      {error ? <span className="reorder-error" role="alert">{error}</span> : null}
    </span>
  );
}
