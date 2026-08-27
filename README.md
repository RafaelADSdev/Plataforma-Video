# Sala do Curso

V1 de uma plataforma de aulas para uma organização e um curso. Professores publicam e ordenam módulos e aulas com vídeo não listado do YouTube, PDFs, cronograma e entregas. Alunos assistem dentro do site, retomam do ponto salvo, registram progresso, comentam no tempo do vídeo e participam da comunidade. Administradores criam todas as contas; não existe cadastro público.

O projeto é independente do HubON e não reutiliza seu repositório, marca, rotas ou código.

## Stack e limites da v1

- Next.js App Router e TypeScript;
- Supabase Auth por e-mail e senha, `@supabase/ssr`, Postgres com RLS e Storage;
- Vercel para deploy;
- YouTube IFrame Player API somente para reprodução e controle do player;
- uma instância, uma organização e um curso;
- sem signup público, OAuth, magic link, convite por e-mail, Realtime, Edge Functions ou upload de vídeo.

Os papéis são `admin`, `professor` e `aluno`. O papel fica em `app_metadata.role`; `admin` herda as permissões de professor.

## Pré-requisitos

- Node.js 22 ou superior;
- npm;
- um projeto hospedado no Supabase;
- acesso ao projeto na Vercel para o deploy;
- Docker somente se quiser executar o Supabase localmente.

Use uma versão recente do Supabase CLI. Antes de copiar comandos para automações, confira a versão e a ajuda da CLI:

```bash
npx supabase --version
npx supabase --help
npx supabase link --help
npx supabase db push --help
```

## 1. Instalar e configurar o app

Instale as dependências e copie o modelo de ambiente:

```bash
npm install
```

No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

No macOS ou Linux:

```bash
cp .env.example .env.local
```

Preencha `.env.local` com valores do projeto Supabase:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Encontre a URL e as chaves em **Supabase Dashboard → projeto → Connect** ou em **Settings → API Keys**.

- Use a publishable key (`sb_publishable_...`) no app. Em um projeto antigo, a chave legada `anon` também pode ser fornecida como valor de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- O script de bootstrap e a criação administrativa de usuários usam `SUPABASE_SECRET_KEY` exclusivamente no servidor/CLI. `SUPABASE_SERVICE_ROLE_KEY` é aceito apenas como fallback para projetos legados.
- `SUPABASE_URL` repete a URL intencionalmente para que o script privilegiado nunca dependa de uma variável `NEXT_PUBLIC_*`.

Nunca coloque a service role em uma variável `NEXT_PUBLIC_*`, Client Component, log, commit ou mensagem. Ela ignora RLS. Consulte [docs/SECURITY.md](docs/SECURITY.md) antes do primeiro deploy.

## 2. Desligar o cadastro público

No projeto hospedado, abra **Authentication → Configuration → General** e desligue a opção global **Allow new users to sign up**. Em **Authentication → Sign In / Providers**, mantenha o provedor **Email** habilitado: ele é necessário para que as contas criadas pelo admin entrem com e-mail e senha. Não habilite anonymous sign-ins, OAuth, magic link ou convite por e-mail.

Esse passo é obrigatório e não é substituído pela ausência de um formulário de cadastro no site. A distinção é importante: o bloqueio global impede novas contas públicas; o provedor Email ativo preserva o login das contas provisionadas pela API administrativa.

Para desenvolvimento local, `supabase/config.toml` deve preservar estas opções:

```toml
[auth]
enable_signup = false
enable_anonymous_sign_ins = false

[auth.email]
# Mantém o provedor de e-mail/senha ativo; o bloqueio público é o global acima.
enable_signup = true
```

Se alterar esse arquivo, confira a ajuda de `npx supabase config push` antes de aplicar configuração a um projeto remoto. Também valide a chave no Dashboard: a configuração local, sozinha, não altera automaticamente um projeto hospedado.

## 3. Linkar o Supabase e aplicar as migrações

Autentique a CLI, associe esta pasta ao projeto correto e visualize as mudanças antes de aplicá-las:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
```

Revise atentamente o projeto exibido pela CLI antes do `db push`. Não use `db reset --linked` em produção: esse comando apaga os dados do banco remoto.

A migração inicial fica em `supabase/migrations/20260826000000_initial_course_platform.sql`. Ela cria:

- as tabelas da plataforma e seus relacionamentos;
- RLS e policies por papel/propriedade/publicação;
- o curso único inicial com o título editável `Meu curso`;
- os buckets privados `covers`, `avatars`, `materials` e `submissions` e suas policies.

Não crie os buckets manualmente antes da migração. Depois do push, confirme em **Storage** que os quatro existem e continuam privados. Para avatar e entrega, as policies incluem `INSERT`, `SELECT` e `UPDATE`, pois a substituição usa upsert.

Se o projeto estiver configurado para não expor automaticamente novas tabelas à Data API, confirme em **Settings → API → Data API** que o schema `public` está exposto e que os papéis `authenticated` têm os grants esperados. Isso é separado de RLS; mantenha ambos.

## 4. Criar o primeiro administrador

O bootstrap usa `auth.admin.createUser` em um script Node local. Ele confirma o e-mail sem enviar mensagem e grava `app_metadata.role = "admin"`. A senha não é salva no Postgres da aplicação e não é exibida.

Com as variáveis de `.env.local` preenchidas, execute em um terminal interativo:

```bash
node --env-file=.env.local scripts/create-first-admin.mjs
```

O script solicita e-mail e senha; a senha fica oculta. Em CI ou terminal não interativo, forneça também `FIRST_ADMIN_EMAIL` e `FIRST_ADMIN_PASSWORD` como secrets temporários do ambiente. Não os adicione ao `.env.example`, ao Git ou à linha de comando.

Ao concluir, ele mostra somente ID, e-mail e papel. Se o e-mail já existir, o script falha sem elevar silenciosamente essa conta. Entre em `/login` com a senha definida e use `/admin/users` para criar professor e aluno. As contas criadas pelo admin também devem receber papel em `app_metadata`, nunca em `user_metadata`.

## 5. Executar localmente

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem sessão, `/` e qualquer rota autenticada devem redirecionar para `/login`.

Antes de entregar uma mudança:

```bash
npm run check
```

`npm run check` encadeia lint, verificação de tipos, testes e build. Para diagnosticar uma etapa isoladamente, use `npm run lint`, `npm run typecheck`, `npm test` ou `npm run build`.

## 6. Deploy na Vercel

1. Crie um projeto novo na Vercel apontando para este repositório novo.
2. Configure o framework como Next.js.
3. Cadastre em **Settings → Environment Variables**, para cada ambiente usado:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_URL`;
   - `SUPABASE_SECRET_KEY` como valor sensível, nunca público.
4. Aplique as migrações ao projeto Supabase correto antes do primeiro acesso ao app.
5. Faça o deploy e repita os testes de permissão abaixo na URL de produção.

Não exponha a service role no navegador nem use um cliente SSR que compartilhe cookies do usuário como cliente administrativo. A criação de usuários precisa ocorrer em Server Action/Route Handler após verificar que a sessão pertence a um `admin`.

## Smoke test da v1

Use três navegadores/perfis separados para evitar confundir sessões. Registre o resultado e teste novamente depois de alterar Auth, RLS, Storage ou middleware.

### Acesso e papéis

- Sem sessão, abrir `/`, `/perfil`, `/comunidade` e uma aula redireciona para `/login`.
- Uma tentativa direta de signup pela API do Supabase é recusada.
- O primeiro admin entra e cria um professor e um aluno com e-mail, senha inicial e papel.
- O aluno não abre `/admin/users` nem `/notificacoes`, não vê CTAs de edição e não consegue chamar as mutações correspondentes diretamente.
- O professor abre `/notificacoes`, mas não `/admin/users`; o admin acessa ambos e herda as ações do professor.

### Curso, player e progresso

- O professor troca capa e dados do curso, cria dois módulos e três aulas e reordena os dois níveis; o aluno recebe a mesma ordem após recarregar.
- Uma URL não listada nos formatos `watch?v=`, `youtu.be/`, `embed/` e `shorts/` gera embed; uma URL inválida impede a publicação com erro em português.
- O aluno pausa no meio, sai e volta: o player busca `lastSeconds`, mostra `Continuando de mm:ss` e a home oferece continuar da aula correta.
- O botão marca e desmarca visto; ao chegar a 90%, a aula fica vista automaticamente e não desmarca sozinha.
- Uma aula com `publishedAt` futuro aparece como agendada para professor/admin e fica invisível para aluno, inclusive por acesso direto.

### Comentários, materiais e entregas

- O aluno comenta com o player em `01:15`; `01:15` aparece antes do texto e o link busca esse ponto do vídeo.
- Uma aula sem vídeo aceita comentário sem timestamp.
- O professor anexa PDF e o aluno consegue baixá-lo.
- Sem `pedeEntrega`, a zona de entrega não aparece e o servidor recusa upload direto.
- Com `pedeEntrega`, o aluno envia e substitui PDF, JPG, PNG ou WebP; outro tipo é recusado em português.
- O professor abre a entrega; outro aluno não consegue listar, baixar ou sobrescrever esse arquivo.

### Comunidade, cronograma, perfil e notificações

- O aluno abre uma dúvida e o professor responde; a resposta do professor aparece destacada e antes das demais.
- As aulas com `scheduledFor` aparecem agrupadas por semana; aluno não recebe conteúdo futuro indevido e professor vê todos os itens.
- Aluno e professor alteram somente o próprio nome, avatar e bio; o upsert de avatar realmente substitui o arquivo.
- Comentário, dúvida e entrega criam notificação para professor/admin, em ordem da mais recente; abrir o alvo marca a notificação como lida.

### Estados, acessibilidade e falhas

- Confira os estados vazios: curso sem módulos, módulo sem aulas, aula sem comentários, comunidade, cronograma, notificações e entrega sem arquivos.
- Simule falha de rede em login, publicação, upload, reordenação, entrega e comentário; a UI deve sair de loading e explicar o erro em português.
- Navegue por teclado: labels ficam visíveis, foco é perceptível, iframe tem `title` e timestamp usa `aria-label="Ir para mm:ss"`.
- Teste uma viewport mobile: navegação, formulários, listas e player 16:9 continuam utilizáveis.

## Definition of Done operacional

A v1 está pronta somente quando o smoke test completo passa, `npm run check` termina sem erro, as migrações local/remota estão alinhadas, os quatro buckets estão privados, o signup público foi comprovadamente recusado e nenhum segredo aparece em código, bundle, log ou Git.

Referências oficiais: [configuração geral do Auth](https://supabase.com/docs/guides/auth/general-configuration), [API administrativa `createUser`](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys) e [workflow de migrações](https://supabase.com/docs/guides/local-development/cli-workflows).
