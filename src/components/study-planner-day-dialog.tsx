"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveStudyPlanDay } from "@/app/actions/study-planner";
import { formatPlannerDate, MAX_STUDY_PLAN_LENGTH } from "@/lib/study-planner";
import styles from "./study-planner.module.css";

export function StudyPlannerDayDialog({
  courseId,
  date,
  initialNote,
  onClose,
  onSaving,
  onSaved,
}: {
  courseId: string;
  date: string;
  initialNote: string;
  onClose: () => void;
  onSaving: (note: string) => void;
  onSaved: (note: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      textarea.current?.focus();
    }
  }, []);

  function save() {
    const nextNote = note.trim();
    setError("");
    startTransition(async () => {
      onSaving(nextNote);
      try {
        const result = await saveStudyPlanDay(courseId, date, nextNote);
        if (!result.ok) {
          setError(result.message ?? "Não foi possível salvar este dia. Tente novamente.");
          return;
        }
        onSaved(nextNote);
        dialog.current?.close();
      } catch {
        setError("Não foi possível salvar este dia. Tente novamente.");
      }
    });
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="planner-day-title"
      onClose={onClose}
      onCancel={(event) => { if (pending) event.preventDefault(); }}
    >
      <div className={styles.dialogHeader}>
        <h2 id="planner-day-title">{formatPlannerDate(date)}</h2>
        <button className={`button ghost ${styles.iconButton}`} type="button" aria-label="Fechar" disabled={pending} onClick={() => dialog.current?.close()}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); save(); }} className={styles.dialogForm}>
        <div className="field">
          <label htmlFor="planner-note">O que você vai estudar?</label>
          <textarea
            ref={textarea}
            className="textarea"
            id="planner-note"
            aria-describedby="planner-note-limit"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_STUDY_PLAN_LENGTH}
            placeholder="Ex.: Matemática — funções e 20 exercícios"
            rows={4}
            readOnly={pending}
          />
          <p id="planner-note-limit" className={`field-hint ${styles.counter}`}>
            {note.length}/{MAX_STUDY_PLAN_LENGTH} caracteres
          </p>
        </div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <div className={styles.dialogActions}>
          {initialNote ? (
            <button className="button ghost" type="button" disabled={pending || !note} onClick={() => {
              setNote("");
              textarea.current?.focus();
            }}>
              Limpar texto
            </button>
          ) : null}
          <button className="button secondary" type="button" disabled={pending} onClick={() => dialog.current?.close()}>
            Cancelar
          </button>
          <button className="button" type="submit" disabled={pending || note.trim() === initialNote}>
            {pending ? "Salvando…" : "Salvar dia"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
