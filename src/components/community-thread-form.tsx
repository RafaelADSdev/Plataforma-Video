"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { createThreadAction, type ThreadActionState } from "@/app/actions/community";
import { createClient } from "@/lib/supabase/client";
import { sanitizeStorageName } from "@/lib/storage";
import {
  COMMUNITY_ATTACHMENT_ACCEPT,
  MAX_COMMUNITY_ATTACHMENTS,
  validateCommunityAttachmentFile,
} from "@/lib/validation";

const initialState: ThreadActionState = { ok: false };

export function CommunityThreadForm({ courseId }: { courseId: string }) {
  const router = useRouter();

  const action = async (state: ThreadActionState, formData: FormData): Promise<ThreadActionState> => {
    const files = formData.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > MAX_COMMUNITY_ATTACHMENTS) {
      return { ok: false, message: `Envie no máximo ${MAX_COMMUNITY_ATTACHMENTS} anexos.` };
    }
    for (const file of files) {
      const validation = validateCommunityAttachmentFile(file);
      if (!validation.ok) return { ok: false, message: `${file.name}: ${validation.error}` };
    }
    formData.delete("attachments");

    const saved = await createThreadAction(state, formData);
    if (!saved.ok || !saved.threadId) return saved;

    if (files.length > 0) {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData.user?.id;
      if (!userId) {
        return {
          ok: false,
          threadId: saved.threadId,
          message: "A dúvida foi publicada, mas os anexos não puderam ser enviados. Entre novamente e tente outra dúvida.",
        };
      }

      for (const file of files) {
        const validation = validateCommunityAttachmentFile(file);
        if (!validation.ok) {
          return { ok: false, threadId: saved.threadId, message: validation.error };
        }
        const path = `${userId}/${saved.threadId}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
        const payload = new File([file], file.name, { type: validation.mimeType });
        const uploaded = await supabase.storage.from("community").upload(path, payload, {
          contentType: validation.mimeType,
          cacheControl: "3600",
        });
        if (uploaded.error) {
          return {
            ok: false,
            threadId: saved.threadId,
            message: `A dúvida foi publicada, mas ${file.name} não foi enviado.`,
          };
        }
        const inserted = await supabase.from("community_thread_attachments").insert({
          thread_id: saved.threadId,
          author_id: userId,
          storage_path: path,
          file_name: file.name,
          mime_type: validation.mimeType,
          size_bytes: file.size,
        });
        if (inserted.error) {
          return {
            ok: false,
            threadId: saved.threadId,
            message: `${file.name} foi enviado, mas não pôde ser ligado à dúvida.`,
          };
        }
      }
    }

    router.push(`/comunidade/${saved.threadId}`);
    router.refresh();
    return saved;
  };

  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <input type="hidden" name="course_id" value={courseId} />
      <div className="field">
        <label htmlFor="thread-title">Título</label>
        <input className="input" id="thread-title" name="title" required minLength={4} maxLength={160} />
        {state.fieldErrors?.title ? <p className="field-error">{state.fieldErrors.title}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="thread-body">Dúvida</label>
        <textarea className="textarea" id="thread-body" name="body" required minLength={8} maxLength={8000} />
        {state.fieldErrors?.body ? <p className="field-error">{state.fieldErrors.body}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="thread-attachments">Anexos</label>
        <input
          className="input"
          id="thread-attachments"
          name="attachments"
          type="file"
          accept={COMMUNITY_ATTACHMENT_ACCEPT}
          multiple
        />
        <p className="field-hint">
          Opcional. PDF, foto, Word, Excel, PowerPoint ou TXT. Até {MAX_COMMUNITY_ATTACHMENTS} arquivos, 20 MB cada.
        </p>
      </div>
      {state.message ? (
        <p className={`form-message${state.ok ? " form-success" : ""}`} role={state.ok ? "status" : "alert"}>
          {state.message}
          {state.threadId && !state.ok ? (
            <>
              {" "}
              <Link href={`/comunidade/${state.threadId}`}>Abrir a dúvida</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Publicando…" : "Publicar dúvida"}
      </button>
    </form>
  );
}
