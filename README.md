# Sala do Curso

Ambiente de estudo de um cursinho, com um curso por instalação. Professores organizam módulos, publicam aulas com vídeo privado e criam atividades de entrega ou questionários. Alunos retomam a aula do ponto salvo, respondem às atividades e acompanham o feedback. Administradores criam as contas.

O projeto é independente do HubON e não reutiliza seu repositório, marca, rotas ou código.

## Stack

- Next.js App Router e TypeScript;
- Supabase Auth por e-mail e senha, `@supabase/ssr`, Postgres com RLS e Storage;
- Vercel para deploy;
- Cloudflare Stream para upload retomável, processamento e reprodução assinada;
- uma instância, uma organização e um curso;
- e-mail e senha com cadastro público desabilitado.

Os papéis são `admin`, `professor` e `aluno`. O papel fica em `app_metadata.role`; `admin` herda as permissões de professor.

## Pré-requisitos

- Node.js 22 ou superior;
- npm;
- um projeto hospedado no Supabase;
- uma conta com Cloudflare Stream ativo para publicar gravações;
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
npm ci
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

As migrações seguintes criam os buckets privados de comunidade, feedback e materiais de atividade. Depois do push, confirme em **Storage** que todos os buckets continuam privados. Ao substituir uma entrega, o app envia um novo arquivo e troca a referência somente após validar o objeto no banco.

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

## 6. Configurar vídeo privado

1. Ative o Stream na conta Cloudflare e crie um token de API com permissão de edição do Stream nessa conta. Cadastre `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_STREAM_API_TOKEN` no servidor.
2. Copie o código do cliente do domínio do player para `CLOUDFLARE_STREAM_CUSTOMER_CODE`. Use somente a parte entre `customer-` e `.cloudflarestream.com`.
3. Gere uma chave de assinatura no Stream. Configure os campos `id` e `jwk` devolvidos pela API em `CLOUDFLARE_STREAM_SIGNING_KEY_ID` e `CLOUDFLARE_STREAM_SIGNING_JWK`. O campo `jwk` já vem codificado em base64. [Chaves e reprodução assinada](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)
4. Em `CLOUDFLARE_STREAM_ALLOWED_ORIGINS`, liste os domínios autorizados para aquele ambiente, sem protocolo e separados por vírgula. Exemplo `aulas.cursinho.com.br`. O limite padrão de duração por gravação é de quatro horas e pode ser ajustado com `CLOUDFLARE_STREAM_MAX_DURATION_SECONDS`.
5. Crie uma aula em rascunho e envie um vídeo pela edição. Aguarde o estado **Gravação pronta**, publique e valide a reprodução com uma conta de aluno no domínio configurado.

### Atualizar uma instalação existente

1. Ensaie as migrações em homologação com uma cópia do esquema e amostras de aulas, arquivos, progresso e feedback. Separe as gravações originais ou exporte-as da conta proprietária no YouTube. [Exportação pelo YouTube](https://support.google.com/youtube/answer/56100?hl=pt-BR)
2. Faça backup do banco e dos arquivos. Coordene a aplicação das novas migrações com a publicação do novo app na Vercel. A versão anterior usa colunas que mudaram.
3. Na edição de cada aula existente, reenvie o arquivo original. Durante a transição, materiais e atividades continuam acessíveis e a aula informa que a gravação aguarda migração. O professor pode consultar a referência original na edição da aula.
4. Após confirmar a reprodução privada com um aluno, altere o vídeo original para **Privado** no YouTube para desativar links antigos. [Visibilidade no YouTube](https://support.google.com/youtube/answer/157177?hl=pt-BR)

Na Vercel, configure as variáveis de `.env.example` para cada ambiente. Use um projeto Supabase de homologação no preview e os valores de produção somente no deploy de produção.

## Validação

Use três navegadores/perfis separados para evitar confundir sessões. Registre o resultado e teste novamente depois de alterar Auth, RLS, Storage ou middleware.

### Acesso e papéis

- Sem sessão, abrir `/`, `/perfil`, `/comunidade` e uma aula redireciona para `/login`.
- Uma tentativa direta de signup pela API do Supabase é recusada.
- O primeiro admin entra e cria um professor e um aluno com e-mail, senha inicial e papel.
- O aluno recebe as próprias notificações de feedback. As páginas de edição, o cadastro de usuários e as mutações de equipe recusam o papel aluno.
- O professor abre `/notificacoes`, mas não `/admin/users`; o admin acessa ambos e herda as ações do professor.

### Curso, player e progresso

- O professor troca capa e dados do curso, cria dois módulos e três aulas e reordena os dois níveis; o aluno recebe a mesma ordem após recarregar.
- O professor interrompe o upload e seleciona o mesmo arquivo para retomá-lo. A publicação de uma aula nova com gravação aguarda o processamento.
- O aluno pausa no meio, sai e volta. O player busca o ponto salvo e a home oferece **Retomar aula**.
- O botão marca e desmarca visto; ao chegar a 90%, a aula fica vista automaticamente e não desmarca sozinha.
- Uma aula com `publishedAt` futuro aparece como agendada para professor/admin e fica invisível para aluno, inclusive por acesso direto.
- Consulte a Data API com a conta de aluno e verifique que `lesson_media` é inacessível. A emissão de autorização deve recusar sessões ausentes e aulas invisíveis. No Stream, valide que o UID avulso e um token expirado não reproduzem o vídeo.

### Comentários, materiais e entregas

- O aluno comenta com o player em `01:15`; `01:15` aparece antes do texto e o link busca esse ponto do vídeo.
- Uma aula sem vídeo aceita comentário sem timestamp.
- O professor anexa PDF e o aluno consegue baixá-lo.
- O professor publica uma entrega avulsa e vincula um questionário a uma aula. O aluno encontra ambos em Atividades e abre o questionário também pela aula.
- O aluno envia e substitui PDF, JPG, PNG ou WebP. O professor responde em privado e a notificação abre a conversa certa. Outro aluno não consegue listar, baixar ou sobrescrever o arquivo.
- O questionário corrige no servidor e registra cada tentativa. Reenviar a mesma requisição devolve o resultado anterior. O gabarito só chega ao aluno após o envio e quando a configuração permite.

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

Referências oficiais do Supabase. [Configuração do Auth](https://supabase.com/docs/guides/auth/general-configuration) · [Criação administrativa de usuários](https://supabase.com/docs/reference/javascript/auth-admin-createuser) · [Chaves](https://supabase.com/docs/guides/getting-started/api-keys) · [Migrações](https://supabase.com/docs/guides/local-development/cli-workflows)
