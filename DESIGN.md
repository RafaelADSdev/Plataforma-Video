---
name: Sala do Curso
description: Ambiente de estudo com retomada de aulas, atividades e gestão docente.
colors:
  ink: "#1b302a"
  muted: "#52635b"
  canvas: "#f6f4ee"
  surface: "#fffefa"
  surface-muted: "#eeede5"
  border: "#dddcd1"
  border-strong: "#8d998b"
  primary: "#176054"
  primary-hover: "#114b41"
  primary-soft: "#e0eee4"
  feature: "#153c36"
  feature-accent: "#d9efaa"
  on-primary: "#ffffff"
  success: "#16724a"
  success-soft: "#e7f5ed"
  warning: "#8a5a00"
  warning-soft: "#fff4d6"
  danger: "#b42318"
  danger-soft: "#fff0ee"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.5vw, 3.15rem)"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.038em"
  loginDisplay:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7vw, 7.75rem)"
    fontWeight: 700
    lineHeight: 0.91
    letterSpacing: "-0.07em"
  emphasis:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.95rem, 3.8vw, 3.4rem)"
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: "-0.057em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.3rem, 1.9vw, 1.65rem)"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.12rem"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 1.05rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 1.05rem"
    height: "2.75rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 0.82rem"
    height: "2.75rem"
  badge-primary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
    rounded: "{rounded.pill}"
---

# Sala do Curso

## Hierarquia

O login usa um painel verde-petróleo com a identidade da sala e um formulário de acesso. No curso, o painel verde destaca a retomada para o aluno e a criação de conteúdo para o professor. A capa cadastrada ocupa a lateral desse painel. Na ausência de capa, a lateral usa os números reais de progresso ou conteúdo.

Os módulos formam uma sequência de listas. Atividades pendentes e cronograma aparecem em painéis secundários. A sala de aula reúne o player e o índice do módulo, com navegação direta para materiais, atividades e comentários.

## Tipografia e cor

Bricolage Grotesque dá escala aos títulos, marca e ações. Inter sustenta campos, descrições e leitura. Números de progresso e timestamps usam algarismos tabulares.

O tema claro combina papel quente e superfícies marfim. O tema escuro usa fundo `#141e1a`, superfície `#1b2822` e texto `#eaf1e9`. Verde-petróleo identifica as ações e a navegação ativa. Estados de conclusão, agendamento, atraso e erro incluem texto visível.

## Layout e interação

A navegação lateral mede 14 rem no desktop. Em até 780 px, um cabeçalho compacto acompanha a navegação inferior com Curso, Atividades, Cronograma e Mais. Em até 960 px, o índice da aula entra no fluxo e pode ser recolhido.

Controles principais medem pelo menos 44 px de altura. O foco permanece visível e o link para pular ao conteúdo é o primeiro destino do teclado. A preferência de tema persiste no navegador, e as transições respeitam a configuração de movimento reduzido.
