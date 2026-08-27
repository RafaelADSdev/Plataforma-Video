"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSubmissionMessageAction } from "@/app/actions/lessons";
import { validateSubmissionFile } from "@/lib/validation";

export function SubmissionMessageForm({
  lessonId,
  studentId,
  isStaff,
}: {
  lessonId: string;
  studentId: string;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const bodyId = `submission-message-${studentId}`;
  const fileId = `submission-message-file-${studentId}`;

  return (
    <form
      className="submission-message-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage("");
        setOk(false);
        const form = event.currentTarget;
        const formData = new FormData(form);
        const body = String(formData.get("body") ?? "").trim();
        const attachment = formData.get("attachment");
        const file = attachment instanceof File && attachment.size > 0 ? attachment : null;
        if (!body && !file) {
          setMessage("Escreva uma mensagem ou anexe a atividade corrigida.");
          return;
        }
        if (file) {
          const validation = validateSubmissionFile(file);
          if (!validation.ok) {
            setMessage(validation.error);
            return;
          }
        }

        setPending(true);
        const result = await createSubmissionMessageAction(lessonId, studentId, formData);
        setMessage(result.message ?? (result.ok ? "Mensagem enviada." : "Não foi possível enviar a mensagem."));
        setOk(result.ok);
        setPending(false);
        if (result.ok) {
          form.reset();
          router.refresh();
        }
      }}
    >
      <div className="field">
        <label htmlFor={bodyId}>{isStaff ? "Responder ao aluno" : "Escrever para o professor"}</label>
        <textarea
          className="textarea"
          id={bodyId}
          name="body"
          maxLength={4000}
          rows={3}
          placeholder={isStaff ? "Envie a correção ou tire a dúvida do aluno." : "Pergunte sobre a entrega ou a correção."}
        />
      </div>
      <div className="field">
        <label htmlFor={fileId}>{isStaff ? "Atividade corrigida" : "Anexo"}</label>
        <input
          className="input"
          id={fileId}
          name="attachment"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        />
        <p className="field-hint">Opcional. PDF, JPG, PNG ou WebP, até 20 MB.</p>
      </div>
      {message ? (
        <p className={`form-message${ok ? " form-success" : ""}`} role={ok ? "status" : "alert"}>
          {message}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Enviando…" : isStaff ? "Responder" : "Enviar mensagem"}
      </button>
    </form>
  );
}
