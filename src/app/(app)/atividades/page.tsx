import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { EmptyState } from "@/components/empty-state";
import { activityResponseCount, activitySummaryColumns, byActivityDueDate, type ActivitySummary } from "@/lib/activities";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFutureDate } from "@/lib/time";

export const metadata: Metadata = { title: "Atividades" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const auth = await requireUser();
  const { ver } = await searchParams;
  const supabase = await createClient();
  const [activitiesResult, modulesResult, lessonsResult] = await Promise.all([
    supabase.from("activities").select(activitySummaryColumns).order("created_at", { ascending: false }),
    supabase.from("modules").select("id,title").order("position").order("id"),
    supabase.from("lessons").select("id,title"),
  ]);
  if (activitiesResult.error || modulesResult.error || lessonsResult.error) throw new Error("Não foi possível carregar as atividades.");
  const activities = (activitiesResult.data ?? []) as ActivitySummary[];
  const tabs = auth.isStaff
    ? [{ value: "", label: "Todas" }, { value: "publicadas", label: "Publicadas" }, { value: "agendadas", label: "Agendadas" }, { value: "rascunhos", label: "Rascunhos" }]
    : [{ value: "", label: "Todas" }, { value: "pendentes", label: "Pendentes" }, { value: "concluidas", label: "Concluídas" }];
  const selected = tabs.find((tab) => tab.value === ver)?.value ?? "";
  const filtered = activities.filter((item) => {
    if (selected === "rascunhos") return !item.published_at;
    if (selected === "agendadas") return item.published_at && isFutureDate(item.published_at);
    if (selected === "publicadas") return item.published_at && !isFutureDate(item.published_at);
    if (selected === "pendentes") return activityResponseCount(item) === 0;
    if (selected === "concluidas") return activityResponseCount(item) > 0;
    return true;
  });
  const modules = modulesResult.data ?? [];
  const lessonTitles = new Map((lessonsResult.data ?? []).map(({ id, title }) => [id, title]));
  const locations = new Map(filtered.filter((item) => item.lesson_id).map((item) => [item.id, lessonTitles.get(item.lesson_id!) ?? "Aula vinculada"]));

  return (
    <main className="container page">
      <header className="page-header">
        <div><h1>Atividades</h1><p className="page-description">{auth.isStaff ? "Publique exercícios e acompanhe as entregas e respostas." : "Encontre exercícios, questionários e devolutivas do professor."}</p></div>
        {auth.isStaff ? <Link href="/atividades/nova" className="button"><Plus size={18} aria-hidden="true" /> Nova atividade</Link> : null}
      </header>
      <nav className="view-filters" aria-label="Filtrar atividades">
        {tabs.map(({ value, label }) => <Link key={label} aria-current={selected === value ? "page" : undefined} href={value ? `/atividades?ver=${value}` : "/atividades"}>{label}</Link>)}
      </nav>
      {filtered.length === 0 ? (
        <EmptyState title={selected ? "Nenhuma atividade neste filtro" : "Nenhuma atividade disponível"}
          action={!selected && auth.isStaff ? <Link href="/atividades/nova" className="button">Criar atividade</Link> : undefined}>
          <p>{selected ? "Escolha outro filtro para ver mais atividades." : auth.isStaff ? "Comece com uma entrega em arquivo ou um questionário." : "As atividades aparecem aqui quando forem publicadas."}</p>
        </EmptyState>
      ) : (
        <div className="stack-lg">
          {modules.map((module) => {
            const items = filtered.filter((activity) => activity.module_id === module.id).sort(byActivityDueDate);
            return items.length ? <section key={module.id} aria-labelledby={`activities-${module.id}`}>
              <h2 id={`activities-${module.id}`}>{module.title}</h2>
              <ActivityList items={items} staff={auth.isStaff} locationNames={locations} />
            </section> : null;
          })}
        </div>
      )}
    </main>
  );
}
