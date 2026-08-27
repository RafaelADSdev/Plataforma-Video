"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyRecommendedScheduleAction } from "@/app/actions/schedule";

export function CopyScheduleButton({
  courseId,
  hasPersonalSlots,
}: {
  courseId: string;
  hasPersonalSlots: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="schedule-copy">
      <button
        className="button secondary"
        type="button"
        disabled={pending}
        onClick={() => {
          const message = hasPersonalSlots
            ? "Isso substitui o seu cronograma atual pelo recomendado do professor. Continuar?"
            : "Copiar o cronograma recomendado para o seu?";
          if (!window.confirm(message)) return;
          startTransition(async () => {
            setError("");
            const result = await copyRecommendedScheduleAction(courseId);
            if (!result.ok) {
              setError(result.message ?? "Não foi possível copiar o cronograma.");
              return;
            }
            router.push("/cronograma?vista=meu");
            router.refresh();
          });
        }}
      >
        {pending ? "Copiando…" : "Copiar do professor"}
      </button>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
