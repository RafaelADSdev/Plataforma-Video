"use client";

import Link from "next/link";
import { useState } from "react";
import { recordSubmissionAction } from "@/app/actions/lessons";
import { createClient } from "@/lib/supabase/client";
import { storageFileUrl } from "@/lib/storage";
import { validateSubmissionFile } from "@/lib/validation";
import type { Submission } from "@/types/domain";

export function SubmissionForm({ lessonId, userId, submission }: { lessonId: string; userId: string; submission: Submission | null }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  return (
    <div className="stack">
      {submission ? (
        <p className="current-file">Seu envio atual: <Link href={`${storageFileUrl("submissions", submission.storage_path)}?nome=${encodeURIComponent(submission.file_name)}`} target="_blank" rel="noreferrer">{submission.file_name}</Link></p>
      ) : <p className="muted">Você ainda não enviou nenhum arquivo para esta aula.</p>}
      <form className="form-grid" onSubmit={async (event) => {
        event.preventDefault();
        setMessage("");
        setOk(false);
        const form = event.currentTarget;
        const fileInput = form.elements.namedItem("submission") as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) {
          setMessage("Escolha um arquivo para enviar.");
          return;
        }
        const validation = validateSubmissionFile(file);
        if (!validation.ok) {
          setMessage(validation.error);
          return;
        }
        setPending(true);
        const storagePath = `${userId}/${lessonId}/entrega`;
        const supabase = createClient();
        const { error } = await supabase.storage.from("submissions").upload(storagePath, file, {
          contentType: validation.mimeType,
          cacheControl: "3600",
          upsert: true,
        });
        if (error) {
          setMessage("Não foi possível enviar o arquivo. Tente novamente.");
          setPending(false);
          return;
        }
        const result = await recordSubmissionAction(lessonId, {
          storagePath,
          fileName: file.name,
          mimeType: validation.mimeType,
          sizeBytes: file.size,
        });
        setMessage(result.message ?? (result.ok ? "Entrega enviada." : "Não foi possível registrar a entrega."));
        setOk(result.ok);
        setPending(false);
      }}>
        <div className="field">
          <label htmlFor="submission">Arquivo da entrega</label>
          <input className="input" id="submission" name="submission" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" />
          <p className="field-hint">PDF, JPG, PNG ou WebP, até 20 MB. Um novo envio substitui o anterior.</p>
        </div>
        {message ? <p className={`form-message${ok ? " form-success" : ""}`} role={ok ? "status" : "alert"}>{message}</p> : null}
        <button className="button" type="submit" disabled={pending}>{pending ? "Enviando entrega…" : submission ? "Substituir entrega" : "Enviar entrega"}</button>
      </form>
    </div>
  );
}
