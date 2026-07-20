---
name: saida-forense
description: >
  Padrão de comunicação de risco e responsabilidade de toda saída do squad forense: escala de
  severidade, disclaimer de que a decisão é do advogado, e gatilho de urgência de prazo. Use
  SEMPRE que um agente forense (análise, tese, estratégia, peça) for entregar algo ao advogado.
---

# Como o squad comunica risco e responsabilidade

Toda saída do squad forense é **orientativa e sugerida** (nasce origem `maquina`, amarela no
painel). O advogado revisa, confirma ou edita, e só então vira decisão. Este padrão garante que o
advogado entenda, num relance, o que é urgente, o que é sugestão e de quem é a responsabilidade.

## 1. Severidade calibrada (marque cada risco/alerta)

Não escreva "atenção" solto. Todo ponto de risco ou alerta recebe um dos quatro níveis:

- 🔴 **Crítico**: prazo fatal iminente, risco de preclusão/perda de direito, medida urgente
  necessária. Exige ação do advogado agora.
- 🟠 **Alto**: afeta o resultado do caso, exige decisão ou providência, mas não é do dia.
- 🟡 **Médio**: relevante, merece atenção, sem urgência.
- 🔵 **Baixo**: informativo, contexto.

Calibre de verdade. Se tudo vira 🔴, nada é 🔴. A maioria dos pontos é 🟠 ou 🟡.

## 2. Gatilho de urgência de prazo

Se a tarefa envolver qualquer prazo processual:

- **Nunca afirme a data fatal de memória.** Quem conta é a ferramenta `calcular_prazo` (código
  determinístico). Você aponta o ato; a data vem da tool.
- Se houver prazo com **5 dias úteis ou menos** até o fim (conforme a tool), abra a saída com um
  alerta 🔴 no topo e recomende conferência imediata do advogado.
- Prazo é matéria de ordem pública e responsabilidade direta do advogado: na menor dúvida sobre
  termo inicial, suspensão local ou rito, marque `[CONFERIR]` e peça confirmação.

## 3. Disclaimer de responsabilidade (uniforme)

Toda saída fecha com uma linha de fronteira, adaptada ao tipo de entrega:

> Material orientativo gerado pela máquina (sugestão, origem `maquina`). A análise, a decisão e a
> responsabilidade são do advogado. Nada aqui foi peticionado, protocolado ou assinado.

Rascunhos de peça usam a versão do `redator-forense` ("RASCUNHO — revise, ajuste e assine antes de
protocolar").

## 4. Incerteza sempre visível

Divergência, tema novo, termo inicial duvidoso ou fonte não confirmada recebem `[CONFERIR]` no
próprio ponto, nunca escondidos no fim. Melhor entregar menos e certo do que muito e incerto.
Complementa a skill `jurisprudencia-real` (que trava a citação); esta trava a comunicação do risco.
