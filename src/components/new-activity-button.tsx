"use client";

import Link from "next/link";
import { ChevronRight, FileText, ListChecks, Plus, X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { activityKindLabel } from "@/lib/activities";

type ActivityLocation = { lessonId?: string; moduleId?: string };

const formats = [
  { kind: "file", icon: FileText, description: "Os alunos enviam um PDF ou uma imagem." },
  { kind: "quiz", icon: ListChecks, description: "Os alunos respondem a questões de múltipla escolha." },
] as const;

export function ActivityFormatOptions({ lessonId, moduleId, onChoose }: ActivityLocation & { onChoose?: () => void }) {
  return (
    <ul className="activity-format-options" role="list">
      {formats.map(({ kind, icon: Icon, description }) => (
        <li key={kind}>
          <Link
            className="activity-row"
            href={{
              pathname: "/atividades/nova",
              query: { tipo: kind, ...(lessonId ? { aula: lessonId } : {}), ...(moduleId ? { modulo: moduleId } : {}) },
            }}
            onNavigate={onChoose}
          >
            <span className="activity-icon"><Icon size={19} aria-hidden="true" /></span>
            <span className="activity-row-copy"><strong>{activityKindLabel(kind)}</strong><small>{description}</small></span>
            <ChevronRight size={18} className="muted" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NewActivityButton({
  lessonId,
  moduleId,
  className = "button",
  icon = <Plus size={18} aria-hidden="true" />,
  label = "Nova atividade",
}: ActivityLocation & { className?: string; icon?: ReactNode; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {icon}{label}
      </button>
      <dialog ref={dialog} className="panel activity-format-dialog" aria-labelledby={headingId} closedby="any">
        <header className="activity-format-heading">
          <h2 id={headingId}>Nova atividade</h2>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={() => dialog.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <ActivityFormatOptions lessonId={lessonId} moduleId={moduleId} onChoose={() => dialog.current?.close()} />
      </dialog>
    </>
  );
}
