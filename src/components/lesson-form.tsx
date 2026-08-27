"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { createLessonAction, updateLessonAction, type LessonActionState } from "@/app/actions/lessons";
import { createClient } from "@/lib/supabase/client";
import { sanitizeStorageName, storageFileUrl } from "@/lib/storage";
import { toSaoPauloDateTimeInput } from "@/lib/time";
import { validateMaterialFile } from "@/lib/validation";
import type { Lesson, Material, Module } from "@/types/domain";

const initialState: LessonActionState = { ok: false };

export function LessonForm({
  modules,
  lesson,
  materials = [],
  scheduledPublication = false,
}: {
  modules: Module[];
  lesson?: Lesson;
  materials?: Material[];
  scheduledPublication?: boolean;
}) {
  const router = useRouter();
  const serverAction = lesson ? updateLessonAction.bind(null, lesson.id) : createLessonAction;

  const action = async (state: LessonActionState, formData: FormData): Promise<LessonActionState> => {
    const files = formData.getAll("materials").filter((item): item is File => item instanceof File && item.size > 0);
    for (const file of files) {
      const validation = validateMaterialFile(file);
      if (!validation.ok) return { ok: false, message: `${file.name}: ${validation.error}` };
    }
    formData.delete("materials");
    const saved = await serverAction(state, formData);
    if (!saved.ok || !saved.lessonId) return saved;

    if (files.length > 0) {
      const supabase = createClient();
      for (const file of files) {
        const validation = validateMaterialFile(file);
        if (!validation.ok) return { ok: false, message: validation.error, lessonId: saved.lessonId };
        const path = `${saved.lessonId}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
        const uploaded = await supabase.storage.from("materials").upload(path, file, {
          contentType: validation.mimeType,
          cacheControl: "3600",
        });
        if (uploaded.error) return { ok: false, lessonId: saved.lessonId, message: `A aula foi salva, mas ${file.name} não foi enviado. Tente novamente na edição.` };
        const inserted = await supabase.from("materials").insert({
          lesson_id: saved.lessonId,
          name: file.name,
          storage_path: path,
          mime_type: validation.mimeType,
          size_bytes: file.size,
        });
        if (inserted.error) return { ok: false, lessonId: saved.lessonId, message: `O PDF ${file.name} foi enviado, mas não pôde ser ligado à aula.` };
      }
    }

    router.push(`/lessons/${saved.lessonId}`);
    router.refresh();
    return saved;
  };

  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="module_id">Módulo</label>
          <select className="select" id="module_id" name="module_id" defaultValue={lesson?.module_id ?? modules[0]?.id} required>
            {modules.map((module) => <option key={module.id} value={module.id}>{module.position}. {module.title}</option>)}
          </select>
          {state.fieldErrors?.module_id ? <p className="field-error">{state.fieldErrors.module_id}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="lesson-title">Título</label>
          <input className="input" id="lesson-title" name="title" defaultValue={lesson?.title ?? ""} required maxLength={160} />
          {state.fieldErrors?.title ? <p className="field-error">{state.fieldErrors.title}</p> : null}
        </div>
      </div>
      <div className="field">
        <label htmlFor="lesson-content">Texto da aula</label>
        <textarea className="textarea lesson-copy-input" id="lesson-content" name="content" defaultValue={lesson?.content ?? ""} required />
        {state.fieldErrors?.content ? <p className="field-error">{state.fieldErrors.content}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="youtube_url">URL do YouTube</label>
        <input className="input" id="youtube_url" name="youtube_url" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" defaultValue={lesson?.youtube_url ?? ""} />
        <p className="field-hint">Opcional. Aceita watch, youtu.be, embed e shorts.</p>
        {state.fieldErrors?.youtube_url ? <p className="field-error">{state.fieldErrors.youtube_url}</p> : null}
      </div>
      <div className="field">
        <span className="field-label">Publicação</span>
        <label className="checkbox"><input type="radio" name="publish_mode" value="now" defaultChecked={!scheduledPublication} /> Publicar agora</label>
        <label className="checkbox"><input type="radio" name="publish_mode" value="scheduled" defaultChecked={scheduledPublication} /> Agendar publicação</label>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="published_at_local">Data e hora da publicação</label>
          <input className="input" id="published_at_local" name="published_at_local" type="datetime-local" defaultValue={lesson ? toSaoPauloDateTimeInput(lesson.published_at) : ""} />
          <p className="field-hint">Usada apenas ao escolher “Agendar”, no fuso de São Paulo.</p>
          {state.fieldErrors?.published_at_local ? <p className="field-error">{state.fieldErrors.published_at_local}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="scheduled_for">Data no cronograma</label>
          <input className="input" id="scheduled_for" name="scheduled_for" type="date" defaultValue={lesson?.scheduled_for ?? ""} />
          <p className="field-hint">Opcional.</p>
        </div>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="requires_submission" defaultChecked={lesson?.requires_submission ?? false} />
        <span><strong>Pedir entrega</strong><br /><span className="field-hint">O aluno poderá enviar ou substituir um PDF ou imagem.</span></span>
      </label>
      <div className="field">
        <label htmlFor="materials">Materiais em PDF</label>
        <input className="input" id="materials" name="materials" type="file" accept="application/pdf,.pdf" multiple />
        <p className="field-hint">Até 20 MB por arquivo.</p>
      </div>
      {materials.length > 0 ? (
        <div>
          <p className="field-label">Materiais atuais</p>
          <ul className="material-list">
            {materials.map((material) => <li key={material.id}><Link href={storageFileUrl("materials", material.storage_path) ?? "#"} target="_blank" rel="noreferrer">{material.name}</Link></li>)}
          </ul>
        </div>
      ) : null}
      {state.message ? <p className={`form-message${state.ok ? " form-success" : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      <button className="button" type="submit" disabled={pending}>{pending ? "Publicando e enviando…" : lesson ? "Salvar aula" : "Publicar aula"}</button>
    </form>
  );
}
