"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteScheduleSlotAction } from "@/app/actions/schedule";
import { ScheduleSlotForm } from "@/components/schedule-slot-form";
import { formatScheduleTimeRange } from "@/lib/schedule";
import type { WeeklyScheduleSlot } from "@/types/domain";

export function ScheduleSlotItem({
  slot,
  canEdit,
}: {
  slot: WeeklyScheduleSlot;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const timeLabel = formatScheduleTimeRange(slot.starts_at, slot.ends_at);

  if (editing && canEdit) {
    return (
      <li className="schedule-slot editing">
        <ScheduleSlotForm
          courseId={slot.course_id}
          defaultWeekday={slot.weekday}
          slot={slot}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="schedule-slot">
      <time dateTime={slot.starts_at}>{timeLabel}</time>
      <p>{slot.note || "Sem observação."}</p>
      {canEdit ? (
        <div className="schedule-slot-actions">
          <button className="button ghost small" type="button" onClick={() => setEditing(true)}>
            Alterar
          </button>
          <button
            className="button danger small"
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Excluir este horário?")) return;
              startTransition(async () => {
                setError("");
                const result = await deleteScheduleSlotAction(slot.id);
                if (!result.ok) {
                  setError(result.message ?? "Não foi possível excluir.");
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pending ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </li>
  );
}
