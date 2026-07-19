# 03. Squad Jurídico e Processo (evolução do Gabinete)

> Projeta a virada do Gabinete de coletor de prazos para sistema jurídico completo com squad de
> IA. Base: MCP `gabinete` v0.1.0 (DataJud, Comunica/DJEN, motor de prazos determinístico),
> Neon/Drizzle e painel Next 16. Mantém a fronteira: o sistema coleta, organiza, analisa e sugere;
> não peticiona, não decide, não é consultoria. A máquina propõe, o profissional dispõe.
> Aprovado em 14/07/2026 (embedding local; auto-cadastro sob comando).

## Ponto de partida (não se reinventa)

- Skill `prazos-cpc` é o padrão de referência: IA classifica, tool calcula, humano confirma.
- Motor de prazos (`prazos.ts`/`feriados.ts`) determinístico e testado, reusado no modal.
- Agente `lex` da agência é EMPRESARIAL (contrato, LGPD, PI), NÃO serve ao forense. Só referência de formato.
- Não há plugin Legal da Anthropic nem recurso jurídico no awesome-claude-code. O squad forense é construído aqui.
- Todo schema replica nos três espelhos: `mcp-server/src/lib/schema.ts`, `painel/src/db/schema.ts`, `supabase/schema.sql`.

## PARTE 1 — Squad de agentes jurídicos

Camadas: **Tool MCP** (ação determinística/persistência, nunca alucina) · **Skill** (como pensar o domínio) · **Subagente** (persona com entregável longo). Regra: o crítico e verificável vira tool (código); o raciocínio jurídico vira subagente guiado por skill.

| Fluxo | Implementação |
|---|---|
| (a) Pré-análise de caso | subagente `analista-caso` |
| (b) Rascunho de petição inicial | subagente `redator-inicial` |
| (c) Estratégia de defesa | subagente `estrategista-defesa` |
| (d) Pesquisa de legislação | tool `pesquisar_legislacao` + skill `legislacao-br` |
| (e) Análise de documento/peça | tools `analisar_documento`/`salvar_analise` + skill `analise-peca` |

- **analista-caso**: recebe fatos de caso novo → pré-análise (tese, viabilidade, fundamentos legais, pedidos, provas, riscos com severidade, próximos passos, [CONFERIR]). Grava em `analises` tipo `pre_analise`.
- **redator-inicial**: consome a pré-análise → rascunho da inicial na estrutura do art. 319 CPC (minuta de trabalho, não peça final).
- **estrategista-defesa**: lê peças/documentos de um processo existente → preliminares, prejudiciais, mérito, provas, pontos frágeis, prazo vinculado.
- Todos bebem de `pesquisar_legislacao` e gravam em `analises`. Fronteira: sugerem, não peticionam nem decidem. Subagentes ficam em `mvp_gabinete/.claude/agents/` (locais ao projeto), `model: sonnet`, MCP `gabinete`.

## PARTE 2 — Legislação brasileira

Decisão: **RAG local dos 7 códigos essenciais (CF, CPC, CC, CLT, CDC, CP, CPP) como base**, LexML sob demanda para normas fora dos códigos, Planalto só como fonte de ingestão do texto. Custo zero, offline, citação precisa por artigo. Embedding **local** (aprovado). Legislação ≠ jurisprudência (esta fica fora do escopo).

Tabelas novas (`pgvector` no Neon): `normas` (apelido, tipo, numero, ano, ementa, urnLex) e `dispositivos` (normaId, artigo, paragrafo, inciso, rotulo, texto, embedding vector(1536), índice HNSW). Ingestão via `mcp-server/scripts/ingerir-legislacao.ts`. Tool `pesquisar_legislacao(consulta, codigos?, topo?)` = busca híbrida vetorial+textual; o `rotulo` (citação) sai do banco, nunca da LLM.

## PARTE 3 — Modelo de dados (mudanças)

- `processos`: `fase` (postulatoria|contestacao|saneamento|instrucao|sentenca|recurso|cumprimento|arquivado), `arquivadoEm`, `excluidoEm` (soft-delete).
- `fases_processo`: histórico de mudança de fase (fase, faseAnterior, motivo, autor, origem).
- `movimentacoes`: + `criadoPor`, `editadoEm` (para as manuais). Trocar a unique por índice parcial só em `fonte='datajud'`: `CREATE UNIQUE INDEX mov_unique_datajud ON movimentacoes (processo_id, codigo_cnj, data_hora) WHERE fonte='datajud'`.
- `anotacoes`: notas livres (processoId, texto, autor, criadoEm, atualizadoEm).
- **Cliente**: tabela `clientes` (nome, documento, tipoDocumento, email, telefone, observacoes) + join `processo_partes` (processoId, clienteId, papel, principal). `processos.clienteNome` vira cache de leitura.
- `documentos`: + `categoria`, `dataDocumento`, `descricao`.

## PARTE 4 — Cadastro via intimação + gestão

- Pré-requisito: `comunicacoes.numeroProcesso` (hoje não é gravado) — adicionar coluna e gravar em `upsertComunicacoes`.
- `auto-cadastro.ts` `autocadastrarDeComunicacoes(comuns)`: para comunicação com numeroProcesso válido e processo inexistente, `consultarProcesso` (DataJud) → `upsertProcesso` → vincula `comunicacao.processoId`. Auto-cadastrar é organização (metadado público), NÃO cria prazo (prazo só via `prazos-cpc`+`calcular_prazo`, sugerido/amarelo).
- Rodar **sob comando** via tool `processar_intimacoes` (aprovado; não automático dentro de buscar_intimacoes).
- Arquivar/excluir: **soft-delete sempre**. `status`: `ativo` | `arquivado` (sai da lista/sync, consultável, reversível) | `excluido` (soft, some da UI, recuperável 30d; hard-delete só via script com dupla confirmação). Excluir na UI pede confirmação (digitar número).
- Movimentações: automáticas (DataJud, read-only) + manuais (`fonte='manual'`, editáveis/removíveis).

## PARTE 5 — Modal do processo (UI)

Intercepting route `@modal/(.)p/[id]` + `p/[id]` cheio (deep-link, voltar nativo no mobile). Server component carrega `detalheProcesso(id)`; abas client recebem props e disparam server actions.
Abas: **Prazos** (reusa `EditarPrazoDialog`/actions existentes, editáveis) · **Estágio** (Select de fase + histórico) · **Timeline** (movimentações auto+manual, CRUD manual) · **Documentos** (lista+upload+categoria, ação analisar) · **Anotações** (CRUD) · **Cliente** (dados + partes com papel).
Server actions novas: `mudarFaseAction`, `adicionarMovimentacaoManualAction`, `editar/removerMovimentacaoAction` (só manual), `adicionar/editar/removerAnotacaoAction`, `salvarClienteAction`, `arquivar/desarquivar/excluirProcessoAction`.
Responsivo: `Dialog` centralizado ≥sm; `Drawer`/`Sheet` full-height <sm, com botões de ação fixos no rodapé.

## PARTE 6 — Plano de implementação (fases pequenas e testáveis)

**Fase 0 [MVP] — Normalização de OAB na `buscar_intimacoes` (base de tudo).**
A OAB do Daniel aparece em 6 formatos no DJEN. `mcp-server/src/lib/oab.ts`: `parseOab` (extrai número, letra, UF), `canonicalOab`, `ehDoAdvogado`. A query ao DJEN usa só dígitos + UF (a API não aceita letra); depois FILTRA por identidade do advogado. Config do alvo por env `OAB_ADVOGADO` no MVP, tabela `advogados` na evolução.
> Refinamento medido na prática: para o Daniel, `11158-A/MT` e `11158-B/MT` são a MESMA pessoa (mesmo nome em 1.145 registros). Identidade = **número + UF** (a letra é ruído de digitação do cartório), com o nome como confirmação para cortar homônimo de número/UF diferente. Alvos do Daniel: `11158/MT` e `43972/SC`.

**Fase 1 [MVP]** — `comunicacoes.numeroProcesso` + `auto-cadastro.ts` + tool `processar_intimacoes`.
**Fase 2 [MVP]** — schema: fase/arquivadoEm/excluidoEm, fases_processo, anotacoes, movimentacoes.criadoPor, clientes, processo_partes, documentos.categoria; `queries.ts` `detalheProcesso`.
**Fase 3 [MVP]** — server actions (fase, movimentação manual, anotação, arquivar/excluir); `listarProcessos` filtra `excluidoEm IS NULL`.
**Fase 4 [MVP]** — modal do processo (intercepting route + 6 abas, responsivo).
**Fase 5 [EVO]** — legislação RAG (pgvector, ingestão, tool `pesquisar_legislacao`, skill `legislacao-br`).
**Fase 6 [EVO]** — `analisar_documento`/`salvar_analise` + skill `analise-peca`.
**Fase 7 [EVO]** — 3 subagentes forenses em `.claude/agents/` + seção Análises na UI.

Ordem: `[MVP] 0 → 1 → 2 → 3 → 4` depois `[EVO] 5 → 6 → 7`.
