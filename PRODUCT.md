# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Aluno:** acessa uma conta criada pela organização para acompanhar o curso, retomar aulas, consultar materiais, enviar arquivos, responder a questionários e acompanhar as devolutivas. Pode participar da comunidade, comentar na aula e adaptar o cronograma semanal.
- **Professor:** organiza módulos, publica aulas e atividades, envia gravações privadas e acompanha as entregas e respostas da turma.
- **Admin:** cria contas e acumula todas as permissões de professor. Uma pessoa pode exercer os dois papéis por meio de `role=admin`.

## Product Purpose

Entregar uma sala de aula digital para um cursinho. O professor publica aulas e atividades e acompanha as respostas. O aluno encontra a próxima aula, retoma a gravação do ponto salvo e resolve as pendências dentro do curso.

## Positioning

A página do curso reúne retomada, módulos e atividades pendentes. A aula integra gravação privada, materiais e comentários com timestamp.

## Operating Context

- Instância única, uma organização e um curso, replicados futuramente pela cópia do projeto.
- Professores enviam gravações ao Cloudflare Stream pela edição da aula. A plataforma verifica a sessão e a disponibilidade da aula antes de emitir uma autorização temporária.
- Professores publicam atividades vinculadas à aula ou avulsas no módulo. As atividades aceitam entrega em PDF ou imagem com feedback privado, ou questões de múltipla escolha com regras de tentativa e revisão.
- O professor define um cronograma semanal recomendado (dia, horário e observação). O aluno consulta essa recomendação, cria a própria semana de estudo ou copia a do professor.
- Interface em pt-BR com navegação adaptada a desktop e celular.

## Capabilities and Constraints

- Next.js App Router com TypeScript, hospedado na Vercel, com Supabase Auth, Postgres e Storage.
- Autenticação exclusiva por e-mail e senha; contas criadas por admin, signup público desligado, sem OAuth, magic link, convite por e-mail ou recuperação de senha na v1.
- Papéis `admin | professor | aluno` ficam somente em `app_metadata`; RLS é obrigatória em todas as tabelas públicas e autorização é aplicada também no servidor.
- `service_role` só pode existir em código de servidor ou scripts locais e nunca em variáveis `NEXT_PUBLIC_*`.
- Rascunhos e conteúdo futuro ficam disponíveis para professor e administrador. A turma vê o conteúdo publicado.
- Sem multi-tenant, seletor de curso, Realtime, Edge Functions, pagamentos, lives, IA, app nativo ou funcionalidades sociais fora das threads e respostas previstas.
- Sala do Curso identifica a aplicação. O título, a descrição e a capa do curso são editáveis pela equipe.

## Brand Commitments

- Não reutilizar nome, marca, rotas ou código do HubON.
- A interface usa fundo quente, verde-petróleo, tipografia expressiva nos títulos e hierarquia consistente entre áreas de estudo e gestão.
- Copy direta em pt-BR.

## Evidence on Hand

Nome, descrição e capa vêm do cursinho. Os indicadores do aluno usam dados de progresso e atividades publicados no curso.

## Product Principles

1. O papel real e a propriedade dos dados valem em toda camada, inclusive RLS e Storage.
2. Vídeo, progresso, comentários e materiais permanecem no contexto da aula. Atividades vinculadas podem ser abertas pela aula e pela lista de atividades.
3. A ordem, publicação e cronograma definidos pelo professor devem persistir e ser inequívocos para o aluno.
4. Estados vazios e falhas explicam o próximo passo em português, sem becos sem saída.
5. Cada instalação atende uma organização e um curso.

## Accessibility & Inclusion

- Labels sempre visíveis, foco perceptível, player com título acessível e timestamps com `aria-label` descritivo.
- Navegação e controles devem funcionar por teclado e em viewport móvel.
- Estados não podem depender apenas de cor para comunicar visto, andamento, agendamento, erro ou destaque de professor.
