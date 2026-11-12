import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth";
import { formDisplayName } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", auth.id).maybeSingle();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <AppHeader auth={auth} displayName={formDisplayName(data?.display_name, auth.email) || auth.email} />
      <div className="app-content" id="conteudo" tabIndex={-1}>{children}</div>
    </div>
  );
}
