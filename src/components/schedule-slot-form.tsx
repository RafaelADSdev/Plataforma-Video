"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createScheduleSlotAction, updateScheduleSlotAction } from "@/app/actions/schedule";
import { initialActionState } from "@/lib/action-state";
import { MAX_SCHEDULE_NOTE_LENGTH, WEEKDAY_LABELS, WEEKDAYS, toTimeInputValue } from "@/lib/schedule";
import type { WeeklyScheduleSlot } from "@/types/domain";

export function ScheduleSlotForm({
  courseId,
  defaultWeekday,
  slot,
  onCancel,
}: {
  courseId: string;
  defaultWeekday: number;
  slot?: WeeklyScheduleSlot;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const formId = slot ? `edit-slot-${slot.id}` : "new-slot";
  const boundUpdate = slot ? updateScheduleSlotAction.bind(null, slot.id) : null;
  const [state, formAction, pending] = useActionState(
    boundUpdate ?? createScheduleSlotAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (!wasPendingRef.current || pending) {
      wasPendingRef.current = pending;
      return;
    }
    wasPendingRef.current = false;
    if (!state.ok) return;
    router.refresh();
    if (slot) onCancel?.();
    else formRef.current?.reset();
  }, [pending, slot, state.ok, onCancel, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="form-grid schedule-slot-form"
      onSubmit={(event) => {
        if (!event.currentTarget.checkValidity()) return;
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <div className="field">
        <label htmlFor={`${formId}-weekday`}>Dia</label>
        <select
          className="select"
          id={`${formId}-weekday`}
          name="weekday"
          defaultValue={slot?.weekday ?? defaultWeekday}
          required
        >
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>{WEEKDAY_LABELS[day].full}</option>
          ))}
        </select>
        {state.fieldErrors?.weekday ? <p className="field-error">{state.fieldErrors.weekday}</p> : null}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${formId}-starts`}>Início</label>
          <input
            className="input"
            id={`${formId}-starts`}
            name="starts_at"
            type="time"
            step={60}
            lang="pt-BR"
            required
            defaultValue={slot ? toTimeInputValue(slot.starts_at) : ""}
          />
          {state.fieldErrors?.starts_at ? <p className="field-error">{state.fieldErrors.starts_at}</p> : null}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-ends`}>Término (opcional)</label>
          <input
            className="input"
            id={`${formId}-ends`}
            name="ends_at"
            type="time"
            step={60}
            lang="pt-BR"
            defaultValue={slot?.ends_at ? toTimeInputValue(slot.ends_at) : ""}
          />
          {state.fieldErrors?.ends_at ? <p className="field-error">{state.fieldErrors.ends_at}</p> : null}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${formId}-note`}>Observação</label>
        <textarea
          className="textarea compact"
          id={`${formId}-note`}
          name="note"
          maxLength={MAX_SCHEDULE_NOTE_LENGTH}
          defaultValue={slot?.note ?? ""}
          placeholder="Ex.: revisar o módulo 2"
        />
        {state.fieldErrors?.note ? <p className="field-error">{state.fieldErrors.note}</p> : null}
      </div>
      {state.message ? (
        <p className={`form-message${state.ok ? " form-success" : ""}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
      <div className="cluster">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : slot ? "Salvar horário" : "Adicionar horário"}
        </button>
        {onCancel ? (
          <button className="button secondary" type="button" onClick={onCancel} disabled={pending}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
