"use client";

import { useActionState } from "react";
import { updateCourseAction } from "@/app/actions/course";
import { initialActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { validateCoverFile } from "@/lib/validation";
import type { Course } from "@/types/domain";

export function CourseEditForm({ course }: { course: Course }) {
  const action = async (state: typeof initialActionState, formData: FormData) => {
    const file = formData.get("cover");
    let coverPath = course.cover_path ?? "";

    if (file instanceof File && file.size > 0) {
      const validation = validateCoverFile(file);
      if (!validation.ok) return { ok: false, message: validation.error };

      const path = `${course.id}/cover`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("covers").upload(path, file, {
        cacheControl: "3600",
        contentType: validation.mimeType,
        upsert: true,
      });
      if (error) return { ok: false, message: "A capa não foi enviada. Tente novamente." };
      coverPath = path;
    }

    // The file has already been sent directly to Storage. Do not serialize it
    // again through the Server Action; only send the fields the action needs.
    const courseData = new FormData();
    courseData.set("title", String(formData.get("title") ?? ""));
    courseData.set("description", String(formData.get("description") ?? ""));
    courseData.set("cover_path", coverPath);
    return updateCourseAction(course.id, state, courseData);
  };

  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <div className="field">
        <label htmlFor="course-title">Título</label>
        <input className="input" id="course-title" name="title" defaultValue={course.title} required maxLength={120} />
        {state.fieldErrors?.title ? <p className="field-error">{state.fieldErrors.title}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="course-description">Descrição curta</label>
        <textarea className="textarea" id="course-description" name="description" defaultValue={course.description ?? ""} maxLength={320} />
        <p className="field-hint">Opcional. Use até 320 caracteres.</p>
        {state.fieldErrors?.description ? <p className="field-error">{state.fieldErrors.description}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="course-cover">Capa do curso</label>
        <input className="input" id="course-cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="field-hint">JPG, PNG ou WebP, até 5 MB.</p>
      </div>
      {state.message ? <p className={`form-message${state.ok ? " form-success" : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      <button className="button" type="submit" disabled={pending}>{pending ? "Salvando e enviando…" : "Salvar curso"}</button>
    </form>
  );
}
