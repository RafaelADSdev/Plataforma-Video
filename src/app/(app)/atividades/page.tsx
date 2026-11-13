import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { EmptyState } from "@/components/empty-state";
import { NewActivityButton } from "@/components/new-activity-button";
import { activityResponseCount, activitySummaryColumns, byActivityDueDate, type ActivitySummary } from "@/lib/activities";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFutureDate } from "@/lib/time";

export const metadata: Metadata = { title: "Atividades" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ ver?: string; modulo?: string }> }) {
  const auth = await requireUser();
  const { ver, modulo } = await searchParams;
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
  const modules = modulesResult.data ?? [];
  const selectedModule = modules.find((module) => module.id === modulo);
  const hasFilter = Boolean(selected || selectedModule);
  const filtered = activities.filter((item) => {
    if (selectedModule && item.module_id !== selectedModule.id) return false;
    if (selected === "rascunhos") return !item.published_at;
    if (selected === "agendadas") return item.published_at && isFutureDate(item.published_at);
    if (selected === "publicadas") return item.published_at && !isFutureDate(item.published_at);
    if (selected === "pendentes") return activityResponseCount(item) === 0;
    if (selected === "concluidas") return activityResponseCount(item) > 0;
    return true;
  });
  const lessonTitles = new Map((lessonsResult.data ?? []).map(({ id, title }) => [id, title]));
  const locations = new Map(filtered.filter((item) => item.lesson_id).map((item) => [item.id, lessonTitles.get(item.lesson_id!) ?? "Aula vinculada"]));

  return (
    <main className="container page">
      <header className="page-header">
        <div><h1>Atividades</h1><p className="page-description">{auth.isStaff ? "Acompanhe as atividades, entregas e respostas de todos os módulos." : "Encontre exercícios, questionários e devolutivas de todos os módulos."}</p></div>
        {auth.isStaff ? <NewActivityButton moduleId={selectedModule?.id} /> : null}
      </header>
      <div className="activity-filters">
        <nav className="view-filters" aria-label="Filtrar atividades por status">
          {tabs.map(({ value, label }) => (
            <Link key={label} aria-current={selected === value ? "page" : undefined} href={{
              pathname: "/atividades",
              query: { ...(value ? { ver: value } : {}), ...(selectedModule ? { modulo: selectedModule.id } : {}) },
            }}>{label}</Link>
          ))}
        </nav>
        {modules.length ? (
          <Form action="/atividades" className="activity-module-filter" key={selectedModule?.id ?? "all"}>
            {selected ? <input type="hidden" name="ver" value={selected} /> : null}
            <label htmlFor="activity-module-filter">Módulo</label>
            <select className="select" id="activity-module-filter" name="modulo" defaultValue={selectedModule?.id ?? ""}>
              <option value="">Todos os módulos</option>
              {modules.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
            </select>
            <button type="submit" className="button secondary">Filtrar</button>
          </Form>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={hasFilter ? "Nenhuma atividade para estes filtros" : "Nenhuma atividade disponível"}
          action={hasFilter ? <Link href="/atividades" className="button secondary">Limpar filtros</Link> : auth.isStaff ? <NewActivityButton label="Criar atividade" icon={null} /> : undefined}>
          <p>{hasFilter ? "Escolha outro módulo ou status para ver mais atividades." : auth.isStaff ? "Comece com uma entrega em arquivo ou um questionário." : "As atividades aparecem aqui quando forem publicadas."}</p>
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
