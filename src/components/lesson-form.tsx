"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createLessonAction, updateLessonAction, type LessonActionState } from "@/app/actions/lessons";
import { LessonVideoUpload } from "@/components/lesson-video-upload";
import { sanitizeStorageName, storageFileUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { isFutureDate, toSaoPauloDateTimeInput } from "@/lib/time";
import { validateMaterialFile } from "@/lib/validation";
import type { Lesson, Material, Module } from "@/types/domain";

export function LessonForm({ modules, lesson, materials = [] }: { modules: Module[]; lesson?: Lesson; materials?: Material[] }) {
  const router = useRouter();
  const savedLessonId = useRef(lesson?.id);
  const newLessonId = useRef<string | null>(null);
  const staged = useRef(new Map<File, { path: string; uploaded: boolean; linked: boolean }>());
  const [result, setResult] = useState<LessonActionState>({ ok: false });
  const [pending, setPending] = useState(false);
  const [videoStatus, setVideoStatus] = useState(lesson?.video_status ?? "none");
  const [publication, setPublication] = useState(
    lesson?.published_at ? isFutureDate(lesson.published_at) ? "scheduled" : "now" : "draft",
  );
  const waitingForVideo = videoStatus !== "none" && videoStatus !== "ready";
  const blockedPublication = waitingForVideo && publication !== "draft"
    && !(publication === "now" && lesson?.published_at && !isFutureDate(lesson.published_at));

  return (
    <form className="form-grid authoring-form" aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault();
      setResult({ ok: false });
      const fields = new FormData(event.currentTarget);
      const files = fields.getAll("materials").filter((item): item is File => item instanceof File && item.size > 0);
      fields.delete("materials");
      for (const file of files) {
        const validation = validateMaterialFile(file);
        if (!validation.ok) {
          setResult({ ok: false, message: `${file.name}: ${validation.error}` });
          return;
        }
      }
      setPending(true);
      try {
        const currentId = savedLessonId.current;
        // A new lesson with attachments stays private until all PDFs are registered.
        const publishAfterFiles = !lesson?.published_at && files.length > 0 && publication !== "draft";
        if (publishAfterFiles) fields.set("publish_mode", "draft");
        const targetId = currentId ?? newLessonId.current ?? crypto.randomUUID();
        newLessonId.current = targetId;
        const saved = currentId
          ? await updateLessonAction(currentId, fields)
          : await createLessonAction(targetId, fields);
        if (!saved.ok || !saved.lessonId) {
          setResult(saved);
          return;
        }
        const id = saved.lessonId;
        savedLessonId.current = id;

        if (files.length) {
          const supabase = createClient();
          for (const file of files) {
            let stagedFile = staged.current.get(file);
            if (!stagedFile) {
              stagedFile = { path: `${id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name).slice(-150)}`, uploaded: false, linked: false };
              staged.current.set(file, stagedFile);
            }
            if (!stagedFile.uploaded) {
              const uploaded = await supabase.storage.from("materials").upload(stagedFile.path, file, { contentType: "application/pdf" });
              if (uploaded.error) {
                setResult({ ok: false, message: `A aula foi salva. Tente novamente para enviar ${file.name}.` });
                return;
              }
              stagedFile.uploaded = true;
            }
            if (!stagedFile.linked) {
              const inserted = await supabase.from("materials").upsert({
                lesson_id: id, name: file.name, storage_path: stagedFile.path, mime_type: "application/pdf", size_bytes: file.size,
              }, { onConflict: "storage_path", ignoreDuplicates: true });
              if (inserted.error) {
                setResult({ ok: false, message: `Tente novamente para vincular ${file.name} à aula.` });
                return;
              }
              stagedFile.linked = true;
            }
          }
        }
        if (publishAfterFiles) {
          fields.set("publish_mode", publication);
          const published = await updateLessonAction(id, fields);
          if (!published.ok) {
            setResult(published);
            return;
          }
        }
        router.push(publication === "draft" && !lesson ? `/lessons/${id}/edit` : `/lessons/${id}`);
        router.refresh();
      } catch {
        setResult({ ok: false, message: "Não foi possível concluir o salvamento. Tente novamente." });
      } finally {
        setPending(false);
      }
    }}>
      <section className="panel authoring-section" aria-labelledby="lesson-content-section">
        <h2 id="lesson-content-section">Conteúdo da aula</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor="module_id">Módulo</label>
            <select className="select" id="module_id" name="module_id" defaultValue={lesson?.module_id ?? modules[0]?.id} required>
              {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
            </select>
            {result.fieldErrors?.module_id ? <p className="field-error">{result.fieldErrors.module_id}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="lesson-title">Título</label>
            <input className="input" id="lesson-title" name="title" defaultValue={lesson?.title ?? ""} required minLength={2} maxLength={160} />
            {result.fieldErrors?.title ? <p className="field-error">{result.fieldErrors.title}</p> : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor="lesson-content">Texto da aula</label>
          <textarea className="textarea" id="lesson-content" name="content" defaultValue={lesson?.content ?? ""} rows={6} maxLength={30000} />
          {result.fieldErrors?.content ? <p className="field-error">{result.fieldErrors.content}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="materials">Materiais em PDF</label>
          <input className="input" id="materials" name="materials" type="file" accept="application/pdf,.pdf" multiple />
          <p className="field-hint">Até 20 MB por arquivo.</p>
        </div>
        {materials.length ? <ul className="material-list">
          {materials.map((material) => <li key={material.id}><Link href={storageFileUrl("materials", material.storage_path)!} target="_blank" rel="noreferrer">{material.name}</Link></li>)}
        </ul> : null}
      </section>

      <section className="panel authoring-section" aria-labelledby="lesson-recording">
        <h2 id="lesson-recording">Gravação privada</h2>
        {lesson ? <LessonVideoUpload lessonId={lesson.id} initialStatus={lesson.video_status} onStatus={setVideoStatus} /> : (
          <p className="muted">Salve a aula como rascunho para adicionar uma gravação antes de publicar.</p>
        )}
      </section>

      <section className="panel authoring-section" aria-labelledby="lesson-publication">
        <h2 id="lesson-publication">Publicação</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor="lesson-publish-mode">Visibilidade</label>
            <select className="select" id="lesson-publish-mode" name="publish_mode" value={publication} onChange={(event) => setPublication(event.target.value)}>
              <option value="draft">Salvar como rascunho</option>
              <option value="now">Publicar agora</option>
              <option value="scheduled">Agendar publicação</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="scheduled_for">Data no cronograma</label>
            <input className="input" id="scheduled_for" name="scheduled_for" type="date" defaultValue={lesson?.scheduled_for ?? ""} />
            <p className="field-hint">Opcional.</p>
          </div>
        </div>
        {publication === "scheduled" ? <div className="field">
          <label htmlFor="published_at_local">Data e hora da publicação</label>
          <input className="input" id="published_at_local" name="published_at_local" type="datetime-local" required defaultValue={lesson?.published_at ? toSaoPauloDateTimeInput(lesson.published_at) : ""} />
          <p className="field-hint">Horário de São Paulo.</p>
          {result.fieldErrors?.published_at_local ? <p className="field-error">{result.fieldErrors.published_at_local}</p> : null}
        </div> : null}
        {blockedPublication ? <p className="form-message" role="status">Espere a gravação ficar pronta para publicar ou salve como rascunho.</p> : null}
      </section>
      {result.message ? <p className="form-message" role="alert">{result.message}</p> : null}
      <div className="cluster">
        <button className="button" type="submit" disabled={pending || blockedPublication}>
          {pending ? "Salvando…" : publication === "draft" ? "Salvar rascunho" : publication === "scheduled" ? "Agendar aula" : "Salvar e publicar"}
        </button>
        <Link className="button ghost" href={lesson ? `/lessons/${lesson.id}` : "/"}>Cancelar</Link>
      </div>
    </form>
  );
}
