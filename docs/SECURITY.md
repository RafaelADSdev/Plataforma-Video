# Segurança operacional

Este projeto usa o Supabase Auth, Postgres com RLS e Storage privado. A segurança não depende de esconder a publishable key: ela depende de sessão válida, autorização no servidor e policies de menor privilégio.

## Chaves e variáveis

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` podem ser usadas pelo navegador. Projetos antigos podem fornecer a chave `anon` como valor da variável de publishable key.
- `SUPABASE_URL` e `SUPABASE_SECRET_KEY` são exclusivas de Server Actions, Route Handlers e do script local de bootstrap. A variável legada `SUPABASE_SERVICE_ROLE_KEY` continua aceita como fallback.
- Nunca prefixe a service role com `NEXT_PUBLIC_`, importe-a em Client Components, registre-a em logs ou a coloque em URLs.
- Valores reais ficam em `.env.local` durante o desenvolvimento e em variáveis protegidas da Vercel. `.env.example` contém apenas placeholders.
- O token de API do Stream e a chave privada de assinatura ficam no servidor. O navegador recebe uma credencial de reprodução com duração de 30 minutos.
- Se uma service role vazar, rotacione-a no Supabase, atualize todos os ambientes e invalide o valor antigo imediatamente.

## Auth e papéis

- O signup público precisa permanecer desligado. Somente um admin cria contas por meio da API administrativa no servidor.
- O papel real é `app_metadata.role` com um dos valores `admin`, `professor` ou `aluno`. Nunca use `user_metadata` para autorização.
- `admin` herda as permissões de professor. A aplicação e as policies devem validar o papel; ocultar um botão na UI não é controle de acesso.
- Mudanças em `app_metadata` podem exigir que o usuário renove a sessão para receber um JWT atualizado.

## Banco e Storage

- Todas as tabelas do schema `public` têm RLS habilitada. Uma policy destinada a `authenticated` ainda precisa restringir papel, propriedade e/ou publicação.
- Entregas são privadas por aluno; um aluno nunca pode listar ou abrir a entrega de outro.
- Os buckets `covers`, `avatars`, `materials`, `activity-materials`, `submissions`, `community` e `feedback` são privados.
- Entregas novas são registradas por função do banco que verifica sessão, atividade publicada e propriedade do objeto. A substituição troca a referência e preserva a conversa.
- `lesson_media` tem acesso exclusivo do servidor. A reprodução exige sessão vigente, aula visível e gravação pronta. O provedor exige token assinado e permite os domínios configurados.
- Os gabaritos ficam no schema `private`. A correção e o consumo de tentativa acontecem na mesma transação. O aluno consulta suas próprias tentativas e recebe o gabarito somente conforme a regra da atividade.
- Arquivos de usuário pertencem ao Storage; nenhum PDF, avatar, capa ou entrega deve ser adicionado ao Git.

## Revisão antes de publicar

1. Confirme no bundle e no painel da Vercel que nenhuma variável `NEXT_PUBLIC_*` contém service role.
2. Confirme que o signup público global e o signup anônimo estão desligados, mas que o provedor Email continua ativo para login com senha.
3. Execute os testes de acesso com aluno, professor, admin e sem sessão descritos no README.
4. Rode o Security Advisor do Supabase e trate os achados de RLS e funções antes da produção.
5. Revise os tipos MIME e limites dos buckets e teste arquivos recusados.
