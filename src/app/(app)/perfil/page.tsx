import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const auth = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,display_name,bio,avatar_path").eq("id", auth.id).maybeSingle();
  const profile: Profile = (data as Profile | null) ?? { id: auth.id, display_name: null, bio: null, avatar_path: null };

  return (
    <main className="container page profile-page">
      <div className="page-header"><div><h1>Perfil</h1><p className="page-description">Atualize a foto, o nome que aparece para a turma e uma bio curta.</p></div></div>
      <section className="panel"><ProfileForm profile={profile} userId={auth.id} email={auth.email} /></section>
    </main>
  );
}
