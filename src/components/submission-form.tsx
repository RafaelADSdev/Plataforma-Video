"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { recordSubmissionAction } from "@/app/actions/activities";
import { createClient } from "@/lib/supabase/client";
import { sanitizeStorageName, storageFileUrl } from "@/lib/storage";
import { validateSubmissionFile } from "@/lib/validation";
import type { Submission } from "@/types/domain";

export function SubmissionForm({ activityId, userId, submission }: { activityId: string; userId: string; submission: Submission | null }) {
  const router = useRouter();
  const staged = useRef<{ file: File; path: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  return (
    <div className="stack">
      {submission ? (
        <p className="current-file">Seu envio atual: <Link href={`${storageFileUrl("submissions", submission.storage_path)}?nome=${encodeURIComponent(submission.file_name)}`} target="_blank" rel="noreferrer">{submission.file_name}</Link></p>
      ) : null}
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
        try {
          if (staged.current?.file !== file) {
            const path = `${userId}/${activityId}/${crypto.randomUUID()}-${sanitizeStorageName(file.name).slice(-150)}`;
            const { error } = await createClient().storage.from("submissions").upload(path, file, {
              contentType: validation.mimeType,
            });
            if (error) throw error;
            staged.current = { file, path };
          }
          const result = await recordSubmissionAction(activityId, { path: staged.current.path, name: file.name });
          setMessage(result.message ?? "");
          setOk(result.ok);
          if (result.ok) {
            staged.current = null;
            form.reset();
            router.refresh();
          }
        } catch {
          setMessage("Não foi possível concluir o envio. Tente novamente.");
        } finally {
          setPending(false);
        }
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
