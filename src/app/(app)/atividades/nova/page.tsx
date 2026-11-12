import type { Metadata } from "next";
import { ActivityAuthoring } from "@/components/activity-authoring";

export const metadata: Metadata = { title: "Nova atividade" };

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ aula?: string }> }) {
  const { aula } = await searchParams;
  return <ActivityAuthoring lessonId={aula} />;
}
