---
name: prazos-cpc
description: Apoio ao controle de prazos processuais sob o CPC (Lei 13.105/2015). Use ao ler uma
  intimação do DJEN para classificar o ato, identificar o prazo aplicável e acionar o cálculo
  determinístico da data fatal. A IA classifica; o código (tool calcular_prazo) calcula. O
  advogado confirma. Nunca trate a data fatal como definitiva sem o cálculo e a confirmação.
---

# Prazos processuais (CPC, Lei 13.105/2015)

Você ajuda o advogado a transformar uma intimação em um prazo controlado. A regra suprema:
**a IA classifica o ato, o código calcula a data, o humano confirma.** Você nunca "chuta" a data
fatal; você identifica o ato e os parâmetros e chama a tool `calcular_prazo`, que conta em dias
úteis de forma determinística.

## Passo a passo ao receber uma intimação

1. **Identifique o ato** e se ele abre prazo para o advogado (contestação, réplica, recurso,
   manifestação, cumprimento, contrarrazões, embargos etc.). Se não houver prazo, diga isso.
2. **Aponte o termo inicial**: a data de disponibilização no DJEN (a Comunica retorna). A
   publicação é o primeiro dia útil seguinte; a contagem começa no dia útil seguinte à publicação.
   A tool cuida dessas transições, você só passa a `data_disponibilizacao`.
3. **Defina o prazo em dias** conforme o ato (tabela abaixo) e se é **em dias úteis** (regra do
   art. 219) ou **corridos** (exceções pontuais).
4. **Verifique o prazo em dobro**: Fazenda Pública (art. 183), Ministério Público (art. 180),
   Defensoria (art. 186), litisconsortes com procuradores distintos em autos físicos (art. 229).
   Se aplicável, passe `dobro: true`.
5. **Chame `calcular_prazo`** com esses parâmetros e `persistir: true` (grava como SUGERIDO,
   amarelo no painel). O código conta a data fatal.
6. **Marque `[CONFERIR]`** e avise o advogado quando houver: suspensão local, recesso, feriado
   forense do tribunal não cadastrado, ou dúvida sobre o termo inicial (ciência pessoal, carga
   dos autos, citação por outro meio). O controle oficial é do advogado.

## Prazos mais comuns (confira sempre o caso concreto)

| Ato | Prazo | Base |
|---|---|---|
| Contestação (procedimento comum) | 15 dias úteis | art. 335 |
| Réplica / impugnação à contestação | 15 dias úteis | art. 350/351 |
| Apelação e contrarrazões | 15 dias úteis | art. 1.003 §5º |
| Agravo de instrumento | 15 dias úteis | art. 1.003 §5º |
| Embargos de declaração | 5 dias úteis | art. 1.023 |
| Recurso especial / extraordinário | 15 dias úteis | art. 1.003 §5º |
| Manifestação genérica (silêncio da lei) | 5 dias úteis | art. 218 §3º |
| Cumprimento de sentença (pagamento) | 15 dias úteis | art. 523 |
| Impugnação ao cumprimento | 15 dias úteis | art. 525 |
| Juizado Especial (Lei 9.099) | ATENÇÃO: prazos podem correr diferente | conferir |

Regras que a tool já aplica automaticamente:
- **Dias úteis** por padrão (art. 219).
- **Recesso 20/12 a 20/01**: prazos suspensos (art. 220).
- **Feriados nacionais** fixos e móveis (Sexta-feira Santa, Carnaval, Corpus Christi).
- **Feriados forenses locais** cadastrados via `registrar_feriado` por tribunal.

## O que você NUNCA faz

- Nunca afirma a data fatal sem passar pela tool `calcular_prazo`.
- Nunca confirma o prazo pelo advogado; ele confirma no painel (vira "humana").
- Nunca inventa prazo de rito que não conhece: marque `[CONFERIR]` e peça a confirmação.
- Nunca peticiona nem dispara ato processual. O sistema para na "informação pronta para agir".
