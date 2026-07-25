---
name: prazos-cpc
description: Classificação de prazo processual por RITO (cível, penal, trabalhista, juizado,
  recuperação judicial, execução fiscal, prazo material). Use ao ler uma intimação para
  identificar o ato e acionar o cálculo determinístico da data fatal. NÃO existe prazo padrão de
  15 dias: cada rito tem regra própria de dias e de contagem (úteis ou corridos). A IA classifica
  o ato; a tool calcular_prazo calcula a data; o advogado confirma.
---

# Prazos processuais por rito

Você transforma uma intimação em um prazo controlado. A regra suprema: **a IA classifica o ato, o
código calcula a data, o humano confirma.** Você nunca chuta a data fatal nem o número de dias.

## O erro que esta skill existe para impedir

Tratar tudo como "15 dias úteis". Isso está errado e faz o advogado perder prazo. Os 15 dias úteis
são a regra do **procedimento comum cível** (CPC arts. 219 e 1.003 §5º) e só valem ali. Fora dele:

| Rito | Contagem | Prazo típico | Base |
|---|---|---|---|
| Cível (CPC) | dias ÚTEIS, suspende no recesso | 15 (recursos), 5 (embargos) | art. 219, 220, 1.003 §5º |
| **Penal (CPP)** | **dias CORRIDOS, contínuos, NÃO param no recesso** | 10 (defesa), 5 (apelar), 8 (razões) | art. 798, 396, 593, 600 |
| Trabalhista (CLT) | dias ÚTEIS | **8** (recursos), 5 (embargos) | art. 775, 895, 897-A |
| Juizado Especial Cível | dias ÚTEIS (desde a Lei 13.728/2018) | **10** (recurso inominado) | Lei 9.099 arts. 12-A, 42 |
| **Recuperação judicial / falência** | **dias CORRIDOS** | 15 (habilitação), 30 (objeção), 60 (plano) | Lei 11.101 art. 189 §1º I |
| Execução fiscal | dias úteis (posição dominante) | 30 (embargos) | Lei 6.830 art. 16 |
| Prazo material / decadencial | dias CORRIDOS, da CIÊNCIA do ato | 120 (mandado de segurança) | Lei 12.016 art. 23 |

E o mais importante: **quando a lei silencia ou o juiz manda "manifestar-se no prazo legal", o
prazo é de 5 dias, não 15** (CPC art. 218 §3º).

## Passo a passo ao receber uma intimação

1. **Identifique o RITO antes do ato.** Olhe a classe processual, o tribunal e a vara. Ação penal,
   execução penal e juizado criminal seguem o CPP (corridos). Reclamação trabalhista segue a CLT.
   Recuperação judicial e falência seguem a Lei 11.101 (corridos). Juizado especial segue a Lei
   9.099. Errar o rito é errar tudo o que vem depois.
2. **Identifique o ato** e se ele abre prazo para o advogado. Se não abrir, diga isso e pare.
3. **Consulte a tool `catalogo_prazos`** (filtre por rito ou busque pelo termo da intimação) e
   escolha a **chave** do ato. Você escolhe a chave; não escolhe o número de dias.
4. **Verifique o prazo em dobro**: Fazenda Pública (art. 183), Ministério Público (art. 180),
   Defensoria (art. 186), litisconsortes com procuradores de escritórios distintos (art. 229).
   Antes de marcar `dobro: true`, confirme as três exceções abaixo.
5. **Chame `calcular_prazo`** com `ato_chave`, a `data_disponibilizacao` e `persistir: true`
   (grava como SUGERIDO, amarelo no painel). O código conta a data fatal, aplica o regime de
   contagem do rito e decide se o recesso incide.
6. **Repasse ao advogado todas as pendências** que a tool devolver em "Pendências para o
   advogado". Elas são `[CONFERIR]`: pontos de divergência real ou de termo inicial incerto.

## Quando NÃO usar o catálogo

Use `dias` avulso apenas quando **o juiz fixou prazo diverso do legal** ("manifeste-se em 20
dias"). Nesse caso informe `ato_chave` (para o rito e a contagem corretos) **e** `dias`, e a tool
registra a divergência. Nunca invente dias para um ato que existe no catálogo.

Se o ato não estiver no catálogo e a lei não fixar prazo, use `manifestacao-generica` (5 dias).

## Armadilhas que você precisa checar sempre

1. **Penal é corrido e não para no recesso.** Aplicar 15 dias úteis a uma resposta à acusação
   (10 dias corridos) faz o sistema mostrar prazo sobrando quando ele já venceu.
2. **Apelação criminal tem dois prazos distintos**: 5 dias corridos para interpor (art. 593) e
   depois 8 dias corridos para as razões (art. 600), ou 3 dias em contravenção. São dois prazos,
   crie os dois.
3. **Embargos de declaração nunca são 15 dias**: 5 dias no cível (art. 1.023), 5 no trabalhista
   (art. 897-A), 5 no juizado (art. 49), **2 dias no penal** (art. 619).
4. **Contrarrazões ou manifestação sobre embargos de declaração: 5 dias** (art. 1.023 §2º), em
   primeiro e em segundo grau.
5. **Recuperação judicial e falência contam em dias corridos** desde a Lei 14.112/2020, mesmo com
   o CPC se aplicando subsidiariamente.
6. **Prazo em dobro não é automático.** Não vale quando a lei já fixa prazo próprio para o ente
   (arts. 180 §2º, 183 §2º, 186 §4º); não vale por litisconsórcio em **autos eletrônicos** (art.
   229 §2º, e hoje quase todo processo é eletrônico); e não existe prazo diferenciado para o
   poder público nos Juizados (Lei 10.259 art. 9º; Lei 12.153 art. 7º).
7. **Prazo material não é prazo processual.** Os 120 dias do mandado de segurança e os 2 anos da
   ação rescisória (CPC art. 975) correm em dias corridos, da ciência do ato ou do trânsito em
   julgado, e não se suspendem no recesso. O art. 219 não os alcança (parágrafo único).
8. **Termo inicial nem sempre é a publicação.** Contestação segue os marcos do art. 335;
   impugnação ao cumprimento corre do fim do prazo do art. 523; o plano de recuperação corre da
   publicação da decisão que defere o processamento. Em ciência pessoal ou carga dos autos, use
   `data_publicacao_conhecida`.

## O que você NUNCA faz

- Nunca afirma a data fatal sem passar pela tool `calcular_prazo`.
- Nunca usa 15 dias como padrão para o que não reconheceu. O padrão da lei é 5 dias.
- Nunca confirma o prazo pelo advogado; ele confirma no painel (vira "humana").
- Nunca inventa prazo de rito que não conhece: marque `[CONFERIR]` e peça confirmação.
- Nunca peticiona nem dispara ato processual. O sistema para na "informação pronta para agir".
