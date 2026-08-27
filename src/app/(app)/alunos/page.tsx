import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { requireProfessor } from "@/lib/auth";
import { publicDisplayName } from "@/lib/profile-name";
import { storageFileUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";

export const metadata: Metadata = { title: "Alunos" };

type StudentCard = {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
};

export default async function StudentsPage() {
  const auth = await requireProfessor();
  let students: StudentCard[] = [];
  let loadError = "";

  try {
    const admin = createAdminClient();
    const supabase = await createClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      loadError = "Não foi possível carregar os alunos.";
    } else {
      const studentUsers = data.users.filter((user) => user.app_metadata?.role === "aluno");
      const ids = studentUsers.map((user) => user.id);
      const { data: profileData } = ids.length
        ? await supabase.from("profiles").select("id,display_name,bio,avatar_path").in("id", ids)
        : { data: [] };
      const profiles = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      students = studentUsers
        .map((user) => {
          const profile = profiles.get(user.id);
          return {
            id: user.id,
            email: user.email ?? "Sem e-mail",
            display_name: profile?.display_name ?? null,
            bio: profile?.bio ?? null,
            avatar_path: profile?.avatar_path ?? null,
          };
        })
        .sort((a, b) =>
          publicDisplayName(a.display_name, a.email).localeCompare(
            publicDisplayName(b.display_name, b.email),
            "pt-BR",
          ),
        );
    }
  } catch {
    loadError = "Configure SUPABASE_SECRET_KEY no servidor para listar a turma.";
  }

  return (
    <main className="container page student-roster-page">
      <div className="page-header">
        <div>
          <h1>Alunos</h1>
          <p className="page-description">Nome, bio e foto de quem está na turma.</p>
        </div>
      </div>
      {loadError ? (
        <p className="form-message" role="alert">{loadError}</p>
      ) : students.length === 0 ? (
        <EmptyState title="Ainda não há alunos na turma">
          <p>
            {auth.isAdmin ? (
              <>Crie as contas em <Link href="/admin/users">Usuários</Link>.</>
            ) : (
              "Peça ao admin para criar as contas da turma."
            )}
          </p>
        </EmptyState>
      ) : (
        <section aria-labelledby="student-list-title">
          <div className="section-heading">
            <div>
              <h2 id="student-list-title">Turma</h2>
              <p className="muted">{students.length === 1 ? "1 aluno" : `${students.length} alunos`}.</p>
            </div>
          </div>
          <ul className="student-roster">
            {students.map((student) => {
              const avatarUrl = storageFileUrl("avatars", student.avatar_path);
              const name = publicDisplayName(student.display_name, "Sem nome ainda");
              return (
                <li key={student.id}>
                  <div className="student-roster-avatar">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={`Foto de ${name}`} fill sizes="56px" unoptimized />
                    ) : (
                      <UserRound aria-hidden="true" size={22} />
                    )}
                  </div>
                  <div>
                    <strong>{name}</strong>
                    <p className="student-roster-email">{student.email}</p>
                    {student.bio ? (
                      <p className="student-roster-bio">{student.bio}</p>
                    ) : (
                      <p className="student-roster-bio muted">Ainda não escreveu uma bio.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
