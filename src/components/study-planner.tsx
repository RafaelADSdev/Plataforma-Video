"use client";

import { ChevronLeft, ChevronRight, FileText, ImageIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useRef, useState } from "react";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/schedule";
import {
  formatPlannerDate,
  formatPlannerMonth,
  shiftPlannerMonth,
  type PlannerWeek,
  type StudyPlan,
} from "@/lib/study-planner";
import { StudyPlannerDayDialog } from "./study-planner-day-dialog";
import styles from "./study-planner.module.css";

type ExportFormat = "pdf" | "png";

function DayButton({ date, note, today, onEdit }: { date: string; note?: string; today: string; onEdit: (date: string) => void }) {
  return (
    <button className={styles.day} type="button" aria-current={date === today ? "date" : undefined} onClick={() => onEdit(date)}>
      <span className="sr-only">{formatPlannerDate(date)}. {note ? "Editar" : "Adicionar estudo"}.</span>
      <span className={styles.dayTop} aria-hidden="true">
        <span className={styles.dayNumber}>{Number(date.slice(-2))}</span>
        {!note ? <Plus size={16} className={styles.dayPlus} /> : null}
      </span>
      {note ? <span className={styles.dayNote}>{note}</span> : null}
    </button>
  );
}

export function StudyPlanner({ courseId, month, today, weeks, notes }: {
  courseId: string;
  month: string;
  today: string;
  weeks: PlannerWeek[];
  notes: StudyPlan;
}) {
  const [selectedDay, setSelectedDay] = useState<{ date: string; note: string } | null>(null);
  const [weekIndex, setWeekIndex] = useState(() => Math.max(0, weeks.findIndex((week) => week.dates.includes(today))));
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const [displayNotes, updateDay] = useOptimistic(notes, (current, change: { date: string; note: string }) => ({
    ...current,
    [change.date]: change.note,
  }));
  const week = weeks[weekIndex];
  const monthLabel = formatPlannerMonth(month);
  const previous = shiftPlannerMonth(month, -1);
  const next = shiftPlannerMonth(month, 1);

  function editDay(date: string) {
    setSelectedDay({ date, note: displayNotes[date] ?? "" });
  }

  async function download(format: ExportFormat) {
    setExportError("");
    setExporting(format);
    try {
      const titleFont = title.current ? getComputedStyle(title.current).fontFamily : undefined;
      const { downloadStudyPlanner } = await import("@/lib/study-planner-export");
      await downloadStudyPlanner(format, month, weeks, displayNotes, titleFont);
    } catch {
      setExportError(`Não foi possível baixar o ${format.toUpperCase()}. Tente novamente.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className={styles.planner} aria-labelledby="planner-title">
      <div className={styles.toolbar}>
        <p>Selecione um dia para adicionar ou editar seus estudos.</p>
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
          <h2 id="planner-title" ref={title}>Planner mensal <span>{month.slice(0, 4)}</span></h2>
          <nav className={styles.monthNav} aria-label="Navegação entre meses">
            {previous ? <Link className={`button ${styles.iconButton}`} href={`/cronograma?mes=${previous}`} scroll={false} aria-label="Mês anterior"><ChevronLeft size={20} aria-hidden="true" /></Link> : null}
            <p id="planner-month" className={styles.monthLabel}>{monthLabel}</p>
            {next ? <Link className={`button ${styles.iconButton}`} href={`/cronograma?mes=${next}`} scroll={false} aria-label="Próximo mês"><ChevronRight size={20} aria-hidden="true" /></Link> : null}
          </nav>
        </div>

        <table className={styles.calendar} aria-labelledby="planner-month">
          <thead>
            <tr>
              <th scope="col" className={styles.weekColumn}>Semana</th>
              {WEEKDAYS.map((day) => <th key={day} scope="col">{WEEKDAY_LABELS[day].full.replace("-feira", "")}</th>)}
            </tr>
          </thead>
          <tbody>
            {weeks.map(({ number, dates }) => (
              <tr key={number}>
                <th scope="row"><span className="sr-only">Semana </span>{number}</th>
                {dates.map((date, dayIndex) => (
                  <td key={WEEKDAYS[dayIndex]} className={date ? undefined : styles.outside}>
                    {date ? <DayButton date={date} note={displayNotes[date]} today={today} onEdit={editDay} /> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.mobileCalendar}>
          <div className={styles.weekPicker}>
            <label htmlFor="planner-week">Ver semana</label>
            <select id="planner-week" className="input" value={weekIndex} onChange={(event) => setWeekIndex(Number(event.target.value))}>
              {weeks.map(({ number, dates }, index) => {
                const days = dates.filter((date) => date !== null).map((date) => Number(date.slice(-2)));
                return <option key={number} value={index}>Semana {number} · {days.length === 1 ? `dia ${days[0]}` : `${days[0]} a ${days.at(-1)}`}</option>;
              })}
            </select>
          </div>
          <ul className={styles.mobileDays}>
            {week.dates.map((date, dayIndex) => date ? (
              <li key={date}>
                <span className={styles.mobileWeekday} aria-hidden="true">{WEEKDAY_LABELS[WEEKDAYS[dayIndex]].short}</span>
                <DayButton date={date} note={displayNotes[date]} today={today} onEdit={editDay} />
              </li>
            ) : null)}
          </ul>
        </div>
      </div>

      <p className="sr-only" role="status">{announcement}</p>
      {selectedDay ? (
        <StudyPlannerDayDialog
          key={selectedDay.date}
          courseId={courseId}
          date={selectedDay.date}
          initialNote={selectedDay.note}
          onClose={() => setSelectedDay(null)}
          onSaving={(note) => updateDay({ date: selectedDay.date, note })}
          onSaved={(note) => setAnnouncement(`${formatPlannerDate(selectedDay.date)}. ${note ? "Plano salvo." : "Plano removido."}`)}
        />
      ) : null}
    </section>
  );
}
