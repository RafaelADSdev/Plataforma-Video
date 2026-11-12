import type { Metadata } from "next";
import { ActivityAuthoring } from "@/components/activity-authoring";

export const metadata: Metadata = { title: "Editar atividade" };

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityAuthoring id={id} />;
}
