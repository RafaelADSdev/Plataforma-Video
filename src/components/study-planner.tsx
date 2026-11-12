"use client";

import { FileText, ImageIcon, Plus } from "lucide-react";
import { useOptimistic, useRef, useState } from "react";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/schedule";
import {
  formatRoutineDay,
  ROUTINE_WEEKS,
  routineDayKey,
  type RoutineDay,
  type RoutineWeek,
  type StudyPlan,
} from "@/lib/study-planner";
import { StudyPlannerDayDialog } from "./study-planner-day-dialog";
import styles from "./study-planner.module.css";

type ExportFormat = "pdf" | "png";

function DayButton({ day, note, onEdit }: { day: RoutineDay; note?: string; onEdit: (day: RoutineDay) => void }) {
  return (
    <button className={styles.day} type="button" onClick={() => onEdit(day)}>
      <span className="sr-only">{formatRoutineDay(day)}. {note ? "Editar rotina" : "Adicionar"}.</span>
      {note ? <span className={styles.dayNote}>{note}</span> : (
        <span className={styles.addDay} aria-hidden="true"><Plus size={16} /> Adicionar</span>
      )}
    </button>
  );
}

export function StudyPlanner({ courseId, notes }: {
  courseId: string;
  notes: StudyPlan;
}) {
  const [selectedDay, setSelectedDay] = useState<{ day: RoutineDay; note: string } | null>(null);
  const [visibleWeek, setVisibleWeek] = useState<RoutineWeek>(1);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const [displayNotes, updateDay] = useOptimistic(notes, (current, change: { day: RoutineDay; note: string }) => ({
    ...current,
    [routineDayKey(change.day)]: change.note,
  }));

  function editDay(day: RoutineDay) {
    setSelectedDay({ day, note: displayNotes[routineDayKey(day)] ?? "" });
  }

  async function download(format: ExportFormat) {
    setExportError("");
    setExporting(format);
    try {
      const titleFont = title.current ? getComputedStyle(title.current).fontFamily : undefined;
      const { downloadStudyPlanner } = await import("@/lib/study-planner-export");
      await downloadStudyPlanner(format, displayNotes, titleFont);
    } catch {
      setExportError(`Não foi possível baixar o ${format.toUpperCase()}. Tente novamente.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className={styles.planner} aria-labelledby="planner-title">
      <div className={styles.toolbar}>
        <p>Selecione um dia para incluir matérias, atividades e horários.</p>
        <div className={styles.exportActions}>
          <button className="button secondary small" type="button" disabled={exporting !== null} onClick={() => download("pdf")}>
            <FileText size={16} aria-hidden="true" /> {exporting === "pdf" ? "Gerando PDF…" : "Baixar PDF"}
          </button>
          <button className="button secondary small" type="button" disabled={exporting !== null} onClick={() => download("png")}>
            <ImageIcon size={16} aria-hidden="true" /> {exporting === "png" ? "Gerando PNG…" : "Baixar PNG"}
          </button>
        </div>
      </div>
      {exportError ? <p role="alert" className={`${styles.error} ${styles.exportError}`}>{exportError}</p> : null}

      <div className={styles.sheet}>
        <div className={styles.heading}>
          <h2 id="planner-title" ref={title}>Rotina de <span>estudos</span></h2>
        </div>

        <table className={styles.routineGrid} aria-labelledby="planner-title">
          <thead>
            <tr>
              <th scope="col" className={styles.weekColumn}>Semana</th>
              {WEEKDAYS.map((day) => <th key={day} scope="col">{WEEKDAY_LABELS[day].full.replace("-feira", "")}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROUTINE_WEEKS.map((week) => (
              <tr key={week}>
                <th scope="row"><span className="sr-only">Semana </span>{week}</th>
                {WEEKDAYS.map((weekday) => (
                  <td key={weekday}>
                    <DayButton day={{ week, weekday }} note={displayNotes[routineDayKey({ week, weekday })]} onEdit={editDay} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.mobileRoutine}>
          <div className={styles.weekPicker}>
            <label htmlFor="planner-week">Ver semana</label>
            <select id="planner-week" className="input" value={visibleWeek} onChange={(event) => setVisibleWeek(ROUTINE_WEEKS[event.target.selectedIndex])}>
              {ROUTINE_WEEKS.map((week) => <option key={week} value={week}>Semana {week}</option>)}
            </select>
          </div>
          <ul className={styles.mobileDays}>
            {WEEKDAYS.map((weekday) => (
              <li key={weekday}>
                <span className={styles.mobileWeekday} aria-hidden="true">{WEEKDAY_LABELS[weekday].short}</span>
                <DayButton day={{ week: visibleWeek, weekday }} note={displayNotes[routineDayKey({ week: visibleWeek, weekday })]} onEdit={editDay} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="sr-only" role="status">{announcement}</p>
      {selectedDay ? (
        <StudyPlannerDayDialog
          key={routineDayKey(selectedDay.day)}
          courseId={courseId}
          day={selectedDay.day}
          initialNote={selectedDay.note}
          onClose={() => setSelectedDay(null)}
          onSaving={(note) => updateDay({ day: selectedDay.day, note })}
          onSaved={(note) => setAnnouncement(`${formatRoutineDay(selectedDay.day)}. ${note ? "Rotina do dia salva." : "Rotina do dia removida."}`)}
        />
      ) : null}
    </section>
  );
}
