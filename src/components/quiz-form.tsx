"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { submitQuizAction } from "@/app/actions/activities";
import type { ActivityQuiz } from "@/types/domain";

export function QuizForm({ activityId, quiz }: { activityId: string; quiz: ActivityQuiz }) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const usedSingleAttempt = !quiz.allowRetries && (quiz.hasAttempt || result?.ok);

  return (
    <form className="form-grid quiz-form" aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault();
      if (pending || usedSingleAttempt) return;
      const form = event.currentTarget;
      const fields = new FormData(form);
      const answers = Object.fromEntries(quiz.questions.map(({ id }) => [id, String(fields.get(id) ?? "")]));
      const key = requestId.current ?? crypto.randomUUID();
      requestId.current = key;
      setPending(true);
      setResult(null);
      try {
        const response = await submitQuizAction(activityId, quiz.revision, key, answers);
        setResult({ ok: response.ok, message: response.message ?? "" });
        if (response.ok) {
          requestId.current = null;
          form.reset();
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: "A conexão foi interrompida. Tente enviar novamente." });
      } finally {
        setPending(false);
      }
    }}>
      {usedSingleAttempt ? <p className="muted">A tentativa disponível foi concluída.</p> : quiz.questions.map((question, index) => (
        <fieldset className="quiz-question" key={question.id} disabled={pending}>
          <legend>Questão {index + 1}</legend>
          <p className="reading">{question.prompt}</p>
          {question.options.map((option) => (
            <label className="quiz-choice" key={option.id}>
              <input type="radio" name={question.id} value={option.id} required />
              <span>{option.text}</span>
            </label>
          ))}
        </fieldset>
      ))}
      {result?.message ? <p className={`form-message${result.ok ? " form-success" : ""}`} role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
      {!usedSingleAttempt ? <button className="button" type="submit" disabled={pending}>{pending ? "Corrigindo…" : "Enviar respostas"}</button> : null}
    </form>
  );
}
