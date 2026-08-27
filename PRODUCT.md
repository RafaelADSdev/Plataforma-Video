# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Aluno:** acessa uma conta criada pela organização para acompanhar um único curso, assistir às aulas dentro do site, retomar o vídeo, registrar progresso, comentar no tempo do vídeo, enviar entregas solicitadas, participar da comunidade, consultar o cronograma recomendado, criar o próprio ou copiar o do professor, e manter seu perfil.
- **Professor:** publica e organiza o curso, acompanha entregas e responde alunos. Precisa operar a plataforma sem depender de ferramentas de vídeo além de colar uma URL não listada do YouTube.
- **Admin:** cria contas e acumula todas as permissões de professor. Uma pessoa pode exercer os dois papéis por meio de `role=admin`.

## Product Purpose

Entregar a v1 de uma sala de aula digital para um único cursinho: um curso com módulos e aulas ordenadas, progresso próprio e retomável, interação contextual, entregas, comunidade e cronograma. O sucesso é a organização conseguir criar professor e aluno, o professor publicar o curso e o aluno completar todo o fluxo sem cadastro público nem sair da plataforma para assistir.

## Positioning

O progresso salvo pela própria plataforma — e não pelo histórico do YouTube — conecta a organização do curso, a retomada precisa do vídeo e os comentários com timestamp em um fluxo único e controlado pelo cursinho.

## Operating Context

- Instância única, uma organização e um curso, replicados futuramente pela cópia do projeto.
- Aulas usam links não listados do YouTube e a IFrame Player API; vídeos nunca são hospedados pelo produto.
- Professores publicam PDFs e solicitam entregas em PDF ou imagem.
- O professor define um cronograma semanal recomendado (dia, horário e observação). O aluno consulta essa recomendação, cria a própria semana de estudo ou copia a do professor.
- Interface e mensagens em pt-BR, desktop primeiro e mobile usável.

## Capabilities and Constraints

- Next.js App Router com TypeScript, hospedado na Vercel, com Supabase Auth, Postgres e Storage.
- Autenticação exclusiva por e-mail e senha; contas criadas por admin, signup público desligado, sem OAuth, magic link, convite por e-mail ou recuperação de senha na v1.
- Papéis `admin | professor | aluno` ficam somente em `app_metadata`; RLS é obrigatória em todas as tabelas públicas e autorização é aplicada também no servidor.
- `service_role` só pode existir em código de servidor ou scripts locais e nunca em variáveis `NEXT_PUBLIC_*`.
- Conteúdo futuro é invisível para aluno e visível, identificado como agendado, para professor/admin.
- Sem multi-tenant, seletor de curso, Realtime, Edge Functions, pagamentos, lives, IA, app nativo ou funcionalidades sociais fora das threads e respostas previstas.
- **Default inferido por indisponibilidade da ferramenta de confirmação:** a navegação usa provisoriamente “Sala do Curso”, sem tratar isso como marca definitiva.
- **Default inferido por indisponibilidade da ferramenta de confirmação:** a migração cria a única linha do curso como “Meu curso”, editável pelo professor/admin.

## Brand Commitments

- Não reutilizar nome, marca, rotas ou código do HubON.
- UI operacional, limpa, com hierarquia clara e cores usadas apenas como sinais mínimos do sistema; não criar visual de marketing, tema elaborado ou ilustrações.
- Copy direta em pt-BR.

## Evidence on Hand

O brief funcional detalhado fornecido pelo usuário é a única fonte de produto. Não há logotipo, capa, conteúdo real de aula, depoimentos, métricas, referências de marca ou outros ativos; nada disso deve ser inventado como fato.

## Product Principles

1. O papel real e a propriedade dos dados valem em toda camada, inclusive RLS e Storage.
2. O aluno permanece no contexto da aula: vídeo, progresso, comentário, material e entrega ficam juntos.
3. A ordem, publicação e cronograma definidos pelo professor devem persistir e ser inequívocos para o aluno.
4. Estados vazios e falhas explicam o próximo passo em português, sem becos sem saída.
5. A v1 permanece deliberadamente de um curso e uma organização.

## Accessibility & Inclusion

- Labels sempre visíveis, foco perceptível, player com título acessível e timestamps com `aria-label` descritivo.
- Navegação e controles devem funcionar por teclado e em viewport móvel.
- Estados não podem depender apenas de cor para comunicar visto, andamento, agendamento, erro ou destaque de professor.
