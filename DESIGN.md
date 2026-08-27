---
name: Sala do Curso
description: Interface operacional, clara e discreta para acompanhar e publicar aulas.
colors:
  ink: "#172033"
  muted: "#5b6475"
  canvas: "#f6f7f9"
  surface: "#ffffff"
  surface-muted: "#eef1f5"
  border: "#d9dee7"
  border-strong: "#aeb7c6"
  primary: "#2457d6"
  primary-hover: "#1947bd"
  primary-soft: "#e9efff"
  success: "#16724a"
  success-soft: "#e7f5ed"
  warning: "#8a5a00"
  warning-soft: "#fff4d6"
  danger: "#b42318"
  danger-soft: "#fff0ee"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 3.2vw, 2.45rem)"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.038em"
  loginDisplay:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 4.6vw, 3.35rem)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  emphasis:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.35rem, 2.2vw, 1.7rem)"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.18rem, 1.8vw, 1.42rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78rem"
    lineHeight: 1.35
  badge:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 750
rounded:
  sm: "0.4rem"
  md: "0.65rem"
  lg: "0.9rem"
  pill: "999px"
spacing:
  xs: "0.45rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 1rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 1rem"
    height: "2.75rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 0.78rem"
    height: "2.75rem"
  badge-primary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
    rounded: "{rounded.pill}"
    padding: "0.24rem 0.52rem"
---

<!--
THESIS: Uma sala de estudo que torna ordem, progresso e próxima ação óbvios; recusa o dashboard ornamental e a estética de marketing.
OWN-WORLD: Base clara, tinta escura, Manrope no display e Inter no corpo, um único azul de ação, marca de roteiro em três linhas, estados semânticos discretos e controles familiares.
STORY: O usuário identifica onde está, o estado de cada aula e a ação disponível; professor e aluno veem somente o que seu papel permite.
FIRST VIEWPORT: Login em duas colunas (marca + lede / formulário); nas telas autenticadas, navegação compacta acima do cabeçalho de curso e da sequência de módulos.
FORM: Aplicação operacional convencional, desktop primeiro, densidade moderada e adaptação direta para uma coluna no mobile; direção fixada pelo brief, sem conceito ornamental.
-->

# Design System: Sala do Curso

## Overview

**Creative North Star: "Roteiro de Aula"**

A interface se comporta como um roteiro bem preparado: ordem explícita, anotações legíveis e sinais suficientes para localizar o próximo passo. A expressão aparece na tipografia, no espaçamento e nos estados, não em ilustrações, efeitos ou superfícies decorativas.

É uma aplicação de operação frequente. Controles seguem convenções da web, a leitura permanece estável em sessões longas e cada papel recebe somente as ações relevantes.

**Key Characteristics:**

- Hierarquia imediata entre contexto, conteúdo e ação.
- Densidade moderada, com listas eficientes e áreas de leitura confortáveis.
- Um acento principal raro; sucesso, alerta e erro aparecem apenas quando carregam significado.
- Estados comunicados por texto, ícone ou forma além da cor.

## Colors

Estratégia restrita: Canvas Frio sustenta a página, Branco de Superfície agrupa conteúdo e Tinta Noturna carrega o texto. Azul de Ação identifica links, foco e ações principais; Verde de Conclusão, Âmbar de Agenda e Vermelho de Falha ficam reservados a estados reais. Os valores normativos estão no frontmatter.

O modo escuro inverte o canvas para Noite de Estudo (`#10141c`) e o texto para Tinta Clara (`#e8ebf1`), mantendo o mesmo azul de ação um pouco mais claro. A troca parte do botão de tema como um círculo que cobre a tela; quem pede movimento reduzido recebe a troca instantânea.

**The Signal-Only Rule.** Cor existe para ação, foco ou estado; nunca para preencher áreas sem função.

## Typography

Duas famílias com papéis fixos. **Manrope** carrega display, títulos, marca, botões, labels, badges e números de posição. **Inter** carrega corpo, descrições, campos e metadados. Display chega a 2.45rem nas telas autenticadas e a 3.35rem no lede de login; títulos de seção ficam em torno de 1.42rem; corpo permanece 1rem com line-height 1.55. Números de tempo e posição usam algarismos tabulares. Textos longos ficam limitados a 72ch.

**The Plain-Language Rule.** Títulos nomeiam a tarefa ou o conteúdo; labels e mensagens de erro dizem exatamente o que aconteceu e o próximo passo.

## Layout

O container central mede no máximo 74rem. Navegação e cabeçalhos permanecem compactos; conteúdo principal usa uma ou duas colunas apenas quando há relação clara, como aula e painel de entregas. Em 860px ou menos, painéis laterais voltam ao fluxo; em 760px ou menos, curso, módulos e listas convergem para uma coluna.

O ritmo espacial usa poucos passos recorrentes: proximidade dentro de um item, separação clara entre grupos e respiro maior antes de um novo contexto. O player mantém 16:9 em qualquer viewport.

## Elevation & Depth

O sistema é predominantemente plano. Fundo, superfícies e bordas tonais estabelecem agrupamento. Sombras aparecem só quando um objeto se separa do fluxo: mensagens flutuantes de reordenação (`0 12px 36px rgba(23, 32, 51, 0.14)`) e o cartão de login (`0 18px 40px rgba(23, 32, 51, 0.08)`).

**The Flat-by-Default Rule.** Cartões de conteúdo não flutuam por decoração; profundidade corresponde a uma relação espacial real.

## Shapes

Cantos de 0.4rem pertencem a controles, 0.65rem a agrupamentos médios e 0.9rem a superfícies principais. Pílulas de 999px ficam restritas a badges curtos de estado. Bordas de 1px e foco exterior de 3px preservam a leitura e a navegação por teclado.

## Components

### Buttons

- **Primary:** Azul de Ação, texto branco, altura mínima de 2.75rem e peso 700.
- **Secondary:** superfície branca, borda forte e texto de Tinta Noturna.
- **Ghost:** sem borda em repouso; fundo azul suave apenas no hover.
- **Focus:** anel azul translúcido de 3px, separado por 3px.

### Cards / Containers

- **Background:** Branco de Superfície sobre Canvas Frio.
- **Corner Style:** 0.9rem nas superfícies principais.
- **Border:** 1px de Divisor Frio; sombra ausente em repouso.
- **Internal Padding:** entre 1rem e 1.5rem conforme densidade.

### Inputs / Fields

- **Style:** fundo branco, borda forte, altura mínima de 2.75rem e canto de 0.4rem.
- **Focus:** borda Azul de Ação mais anel externo azul translúcido.
- **Error:** mensagem Vermelho de Falha sobre Vermelho Suave, sempre textual.

### Navigation

A marca é um livro aberto em um quadrado azul — o caderno da sala — ao lado do nome em Manrope. Links usam texto muted em repouso e Azul Profundo sobre Azul Suave no estado ativo. Em viewports estreitas, a navegação permanece horizontal com scroll, preservando todos os destinos e sem menu oculto adicional.

### Status Badges

Pílulas compactas unem texto e, quando útil, ícone. Conclusão, andamento e agendamento usam pares semânticos distintos e nunca aparecem somente como pontos coloridos.

## Motion

O caderno cede ao toque e abre espaço quando o foco muda. Movimento explica estado, não enfeita.

- **Momento autoral:** a troca de tema expande um círculo a partir do botão; a conversa da entrega sobe ao centro (escala, opacidade e fundo).
- **Continuidade:** módulos e tópicos da comunidade assentam em sequência curta (até 200 ms de atraso).
- **Feedback:** botões comprimem no clique; navegação, linhas de aula, threads e tabelas suavizam cor e fundo.
- Duração de rotina 140–200 ms; overlay 320 ms; curva `cubic-bezier(0.16, 1, 0.3, 1)`.
- `prefers-reduced-motion` remove animações, atrasos e o compressão do clique.

## Do's and Don'ts

### Do:

- **Do** priorizar ordem, estado e próxima ação em cada tela.
- **Do** manter labels visíveis, áreas clicáveis confortáveis e foco evidente.
- **Do** usar mensagens e estados vazios úteis em pt-BR.
- **Do** preservar a mesma linguagem entre desktop e mobile.

### Don't:

- **Don't** usar gradientes, vidro, brilho, ilustrações, parallax, bounce ou scroll-reveal de seções.
- **Don't** transformar módulos, aulas ou respostas em um mural de cartões sem hierarquia.
- **Don't** depender somente de cor para distinguir papel, progresso ou publicação.
- **Don't** criar navegação, telas ou ações fora do recorte funcional confirmado.
