import type { Metadata } from "next";
import { createUserAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { requireAdmin, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeInSaoPaulo } from "@/lib/time";
import type { AppUser } from "@/types/domain";

export const metadata: Metadata = { title: "Usuários" };

const roleLabels: Record<Role, string> = { admin: "Admin", professor: "Professor", aluno: "Aluno" };

export default async function UsersAdminPage() {
  await requireAdmin();
  let users: AppUser[] = [];
  let loadError = "";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) loadError = "Não foi possível carregar as contas.";
    else users = data.users.map((user) => ({
      id: user.id,
      email: user.email ?? "Sem e-mail",
      role: user.app_metadata?.role === "admin" || user.app_metadata?.role === "professor" ? user.app_metadata.role : "aluno",
      createdAt: user.created_at,
    })).sort((a, b) => a.email.localeCompare(b.email));
  } catch {
    loadError = "Configure SUPABASE_SECRET_KEY no servidor para administrar contas.";
  }

  return (
    <main className="container page">
      <div className="page-header"><div><h1>Usuários</h1><p className="page-description">Crie as contas da organização. Não existe cadastro público.</p></div></div>
      <div className="admin-users-layout">
        <section aria-labelledby="users-title">
          <div className="section-heading"><div><h2 id="users-title">Contas criadas</h2><p className="muted">Até 200 contas, em ordem de e-mail.</p></div></div>
          {loadError ? <p className="form-message" role="alert">{loadError}</p> : users.length === 0 ? (
            <EmptyState title="Nenhuma conta encontrada"><p>Use o formulário ao lado para criar a primeira conta.</p></EmptyState>
          ) : (
            <div className="table-wrap"><table><thead><tr><th>E-mail</th><th>Papel</th><th>Criada em</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.email}</td><td><span className={`badge ${user.role === "aluno" ? "" : "primary"}`}>{roleLabels[user.role]}</span></td><td>{formatDateTimeInSaoPaulo(user.createdAt)}</td></tr>)}</tbody></table></div>
          )}
        </section>
        <aside className="panel create-user-panel" aria-labelledby="create-user-title">
          <h2 id="create-user-title">Criar usuário</h2>
          <p className="muted">Defina uma senha inicial e compartilhe-a por um canal seguro.</p>
          <ActionForm action={createUserAction} submitLabel="Criar conta" pendingLabel="Criando conta…" fieldLabels={{ email: "E-mail", password: "Senha inicial", display_name: "Nome", role: "Papel" }} noValidate>
            <div className="field"><label htmlFor="user-email">E-mail</label><input className="input" id="user-email" name="email" type="email" autoComplete="off" required /></div>
            <div className="field"><label htmlFor="user-display-name">Nome</label><input className="input" id="user-display-name" name="display_name" autoComplete="off" maxLength={80} placeholder="Nome e sobrenome" /><p className="field-hint">Opcional. A pessoa também pode preencher depois no perfil.</p></div>
            <div className="field"><label htmlFor="user-password">Senha inicial</label><input className="input" id="user-password" name="password" type="password" autoComplete="new-password" minLength={8} required /><p className="field-hint">Pelo menos 8 caracteres.</p></div>
            <div className="field"><label htmlFor="user-role">Papel</label><select className="select" id="user-role" name="role" defaultValue="aluno"><option value="aluno">Aluno</option><option value="professor">Professor</option><option value="admin">Admin (inclui professor)</option></select></div>
          </ActionForm>
        </aside>
      </div>
    </main>
  );
}
