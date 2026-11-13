import Link from "next/link";
import { ArrowUpRight, ClipboardList, FileText, ListChecks } from "lucide-react";
import { activityKindLabel, activityPublication, activityResponseCount, type ActivitySummary } from "@/lib/activities";
import { formatDateTimeInSaoPaulo, isFutureDate } from "@/lib/time";

export function ActivityIcon({ kind }: { kind: ActivitySummary["kind"] }) {
  return kind === "quiz" ? <ListChecks size={19} aria-hidden="true" /> : <FileText size={19} aria-hidden="true" />;
}

export function ActivityList({
  items,
  locationNames,
  staff = false,
}: {
  items: ActivitySummary[];
  locationNames?: Map<string, string>;
  staff?: boolean;
}) {
  return (
    <ul className="activity-list">
      {items.map((item) => {
        const publication = activityPublication(item.published_at);
        const count = activityResponseCount(item);
        const completed = count > 0;
        const overdue = Boolean(item.due_at && !isFutureDate(item.due_at));
        return (
          <li key={item.id}>
            <Link className="activity-row" href={`/atividades/${item.id}`}>
              <span className="activity-icon"><ActivityIcon kind={item.kind} /></span>
              <span className="activity-row-copy">
                <strong>{item.title}</strong>
                <small>{activityKindLabel(item.kind)}{locationNames?.get(item.id) ? ` · ${locationNames.get(item.id)}` : ""}</small>
                {item.due_at ? <small>Prazo {formatDateTimeInSaoPaulo(item.due_at)}</small> : null}
              </span>
              <span className="activity-row-meta">
                <span className={`badge ${staff ? publication.tone : completed ? "success" : overdue ? "warning" : ""}`}>
                  {staff ? publication.label : completed ? item.kind === "file" ? "Enviada" : "Respondido" : overdue ? "Em atraso" : "Pendente"}
                </span>
                {staff ? <small>{count} {item.kind === "file" ? count === 1 ? "entrega" : "entregas" : count === 1 ? "tentativa" : "tentativas"}</small> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivitySidePanel({ staff }: { staff: boolean }) {
  return (
    <section className="panel study-side-panel">
      <span className="study-side-icon"><ClipboardList size={21} aria-hidden="true" /></span>
      <h2>Atividades da turma</h2>
      <Link href="/atividades" className="inline-link">{staff ? "Gerenciar atividades" : "Ver todas as atividades"} <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </section>
  );
}
