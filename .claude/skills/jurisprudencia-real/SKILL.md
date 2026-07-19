---
name: jurisprudencia-real
description: >
  Regra de verificação de toda citação de lei, súmula e jurisprudência antes de usá-la numa
  análise, estratégia ou peça. Use SEMPRE que for citar um dispositivo legal, uma súmula ou um
  julgado. Nenhum agente forense do Gabinete cita sem passar por aqui.
---

# Só jurisprudência e lei reais e verificáveis

A regra é inegociável: **nenhuma citação sai da sua memória.** Toda lei, súmula e julgado vem de
uma fonte oficial consultada agora, e vai para o texto **com o link/fonte** para o advogado
conferir. Estudos mostram que IA jurídica inventa citação em 1 de cada 6 respostas; aqui isso é
proibido. Uma citação falsa expõe o advogado a responsabilidade, então na dúvida NÃO cite.

## O que conta como fonte oficial

- **Lei/dispositivo**: Planalto (planalto.gov.br), LexML (lexml.gov.br).
- **Jurisprudência**: sites oficiais dos tribunais (STF, STJ, TJs, TRFs, TST), Diário de Justiça
  Eletrônico (DJEN/CNJ), bases oficiais de acórdãos. Nunca blog, resumo ou "achei que existe".

## Trava dura de lei, artigo, parágrafo e inciso (o erro mais comum)

O modelo inventa com mais frequência **dispositivo legal** do que jurisprudência: troca o número
do artigo, cria um parágrafo que não existe, atribui a lei errada, ou "lembra" um texto que não é
o oficial. Contra isso, a regra é mecânica e sem exceção:

1. **Nunca escreva o número nem o texto de um artigo de memória.** Toda vez que for citar
   `art. X`, `§ Y`, `inciso Z` de qualquer lei, **abra a fonte oficial (Planalto/LexML) e copie
   dali**. Se você não abriu a fonte nesta tarefa, você não pode citar o dispositivo.
2. **Confirme os quatro elementos na fonte**: (a) a **lei** é a certa (número e ano), (b) o
   **artigo** existe e é esse número, (c) o **parágrafo/inciso** existe dentro daquele artigo,
   (d) o **texto** que você reproduz é o texto oficial, palavra por palavra se estiver entre aspas.
3. **Não parafraseie como se fosse literal.** Ou você cita o texto oficial entre aspas (copiado da
   fonte) ou descreve com suas palavras deixando claro que é resumo — nunca invente uma redação.
4. **Lei revogada ou alterada**: confira a vigência na fonte. Não cite dispositivo revogado como
   vigente.
5. **Na menor dúvida sobre existência ou redação de um dispositivo, não o cite.** Escreva
   `[CONFERIR: dispositivo não confirmado na fonte]` e siga.

## Procedimento obrigatório para cada citação

1. **Busque de verdade** a lei/súmula/julgado numa fonte oficial (WebSearch/WebFetch na fonte, ou
   a tool `pesquisar_legislacao` quando disponível). Não avance sem encontrar.
2. **Confirme os três pontos** antes de usar:
   - o dispositivo/julgado **existe** (número, órgão, data batem com a fonte);
   - o **texto** que você vai citar é o que está na fonte (não parafraseie como se fosse literal);
   - o julgado realmente **sustenta a tese** que você está apoiando (não basta ser sobre o tema).
3. **Traga a fonte junto**: cada citação no texto final leva o link ou a referência oficial
   (ex.: `STJ, REsp 1.234.567/SP, 3ª Turma, DJe 10/03/2025 — <link>`).
4. **Se não encontrar** jurisprudência real que sustente o ponto: diga com todas as letras
   "não localizei jurisprudência pacífica sobre isto" e siga sem citar. Jamais fabrique número,
   ementa, órgão ou data.

## Formato de saída dos fundamentos

Cada fundamento entregue segue este bloco, sem exceção:

```
- Tese: <o que se quer sustentar>
  Fundamento: <lei/súmula/julgado> — <órgão, número, data>
  Fonte: <link ou referência oficial verificada>
  Aderência: <por que este fundamento sustenta a tese>
```

## Marca de incerteza

Divergência jurisprudencial, tema novo ou fonte que você não conseguiu confirmar recebem
`[CONFERIR]` e a recomendação de o advogado validar. Melhor entregar menos e certo do que muito
e inventado.
