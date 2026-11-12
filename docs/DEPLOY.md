# Publicação e migração

[Voltar ao README](../README.md)

## Preparar o Supabase

Use um projeto Supabase para cada instalação. Separe o projeto de homologação do projeto de produção.

1. Mantenha o provedor **Email** habilitado e desative o cadastro público e o acesso anônimo no painel de autenticação. Contas são criadas pelo administrador. [Configuração do Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration)
2. Preencha o [modelo de ambiente](../.env.example) com a URL e as chaves do projeto. A publishable key é usada pelo navegador. A chave secret e a URL de administração ficam no servidor. Projetos legados podem usar a chave `anon` como publishable key e `SUPABASE_SERVICE_ROLE_KEY` como fallback da chave secret. [Chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
3. Vincule a CLI ao projeto correto e revise as migrações antes de aplicá-las. Para uma instalação existente, siga a sequência de migração abaixo antes do `db push`. [Fluxo de migrações do Supabase](https://supabase.com/docs/guides/local-development/cli-workflows)

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
```

As migrações criam o curso inicial `Meu curso`, as tabelas, as políticas de acesso e os buckets privados. Confirme no painel que o schema `public` está disponível na Data API e que os buckets permanecem privados. As permissões e o RLS limitam o que cada papel pode acessar.

## Criar o primeiro administrador

Com o ambiente preenchido, execute o bootstrap em um terminal interativo.

```bash
node --env-file=.env.local scripts/create-first-admin.mjs
```

O script solicita e-mail e senha e atribui `app_metadata.role = "admin"`. Para execução não interativa, forneça `FIRST_ADMIN_EMAIL` e `FIRST_ADMIN_PASSWORD` como segredos temporários do ambiente. Entre em `/login` e use **Contas** para cadastrar a equipe e os alunos. [Criação administrativa de usuários](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

## Configurar o Cloudflare Stream

Ative o Stream e crie um token de API com permissão de edição do Stream na conta. Cadastre estas variáveis no servidor. [Upload direto retomável](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) · [Chaves de assinatura](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)

| Variável | Configuração |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador da conta que hospeda os vídeos. |
| `CLOUDFLARE_STREAM_API_TOKEN` | Token da API com permissão de edição do Stream. |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | Trecho do domínio entre `customer-` e `.cloudflarestream.com`. |
| `CLOUDFLARE_STREAM_SIGNING_KEY_ID` | Campo `id` retornado ao criar a chave de assinatura. |
| `CLOUDFLARE_STREAM_SIGNING_JWK` | Campo `jwk` retornado pela API, já codificado em base64. |
| `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` | Domínios autorizados, separados por vírgula e sem protocolo. |
| `CLOUDFLARE_STREAM_MAX_DURATION_SECONDS` | Duração máxima do upload. O padrão é 14.400 segundos, ou quatro horas. |

Na homologação, crie uma aula em rascunho e envie um vídeo pela edição. Quando aparecer **Gravação pronta**, publique e reproduza com uma conta de aluno no domínio configurado.

## Publicar na Vercel

Cadastre as variáveis de [`.env.example`](../.env.example) para cada ambiente. O preview deve apontar para o Supabase de homologação. Prepare a compilação de produção com as variáveis e o domínio da instalação real. Use a promoção manual durante a migração para coordenar a aplicação do novo esquema com a troca da versão pública. [Compilação de produção em preparação](https://vercel.com/docs/deployments/promoting-a-deployment)

## Migrar uma instalação existente

1. Ensaie as migrações em homologação com amostras de aulas, progresso, entregas e feedback. Valide upload e reprodução no Stream com uma conta de aluno.
2. Separe os arquivos originais das gravações ou exporte-os da conta proprietária do YouTube. [Exportar vídeos próprios](https://support.google.com/youtube/answer/56100?hl=pt-BR)
3. Faça backup do banco e dos arquivos e agende a janela de troca. Aplique as migrações ao projeto correto e promova a compilação correspondente na mesma janela. A versão antiga usa colunas que mudaram.
4. Abra a edição de cada aula e reenvie a gravação. Durante a transição, a aula informa que o vídeo aguarda migração. Os materiais, o progresso, os comentários e as atividades continuam vinculados à aula.
5. Confirme cada reprodução privada com uma conta de aluno e coloque a gravação original do YouTube como **Privada** para desativar links antigos. [Visibilidade no YouTube](https://support.google.com/youtube/answer/157177?hl=pt-BR)

## Verificar a instalação

Execute `npm run check` e confira os fluxos com sessões separadas de visitante, aluno, professor e administrador.

- **Acesso.** Confira o redirecionamento para login, o bloqueio do cadastro público e as permissões das páginas de edição e administração. O aluno deve ver somente as próprias notificações de feedback.
- **Curso.** Crie módulos, reordene aulas e atividades avulsas e verifique a ordem com a conta de aluno. Rascunhos e publicações futuras devem permanecer indisponíveis para a turma, inclusive pela Data API.
- **Gravações.** Interrompa e retome o envio com o mesmo arquivo. Verifique publicação após processamento, retomada do ponto salvo, marcação de conclusão e comentários com timestamp. Teste também autorização expirada, sessão ausente e acesso direto ao identificador do vídeo.
- **Atividades.** Abra uma atividade vinculada pela aula e uma avulsa pelo módulo. Envie e substitua um arquivo, confira a conversa privada e tente abrir o arquivo de outro aluno. No questionário, verifique o limite de tentativas, o reenvio da mesma tentativa e a exibição do gabarito.
- **Navegação.** Confira comunidade, cronograma, perfil e notificações nos dois temas. Use teclado e celular para testar foco, player e formulários. Simule falhas de rede durante envio e publicação e verifique as opções de recuperação.
