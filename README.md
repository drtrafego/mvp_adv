# Gabinete

Sistema para advogado que **coleta processos, calcula prazos e analisa documentos**, comandado
pelo terminal (Claude Code) via um MCP jurídico, com painel web e banco no Neon. Implementação de
referência do documento mestre da mentoria "Gabinete".

Princípio central: **a máquina propõe, o humano dispõe.** Todo dado nasce sugerido (máquina); o
advogado confirma e vira definitivo. O campo crítico (data fatal do prazo) é sempre calculado por
código determinístico, nunca por LLM.

## Arquitetura

```
[terminal / Claude Code]  --usa-->  [MCP jurídico (mcp-server/)]
                                          |  tools
                    DataJud (CNJ) <-------+-------> Comunica/DJEN (CNJ)
                                          |
                                     [Neon (Postgres)]  <-- fonte da verdade
                                          |
                                   [painel (Next.js/Vercel)] --> vê e edita, atualiza sozinho
```

- **`mcp-server/`** — servidor MCP (stdio, TypeScript). 18 tools: `consultar_processo`,
  `adicionar_processo`, `sincronizar_carteira`, `pesquisar_carteira`, `status_sincronizacao`,
  `buscar_intimacoes`, `processar_intimacoes`, `reconciliar_intimacoes`, `catalogo_prazos`,
  `calcular_prazo`, `listar_prazos`, `confirmar_prazo`, `editar_prazo`, `registrar_feriado`,
  `salvar_analise`, `buscar_modelos`, `salvar_peca`, `baixar_autos`.
  Motor de prazos determinístico com catálogo por rito
  (`lib/catalogo-prazos.ts`): dias úteis no cível (CPC art. 219) e no trabalhista (CLT art. 775),
  dias corridos e contínuos no penal (CPP art. 798) e na recuperação judicial (Lei 11.101
  art. 189 §1º I). Com testes.
- **`painel/`** — Next.js 16 + shadcn/ui + Tailwind v4 + Drizzle/Neon. Lista de prazos com cores
  por estado, edição inline (vira humana), atualização automática a cada 30s.
- **`supabase/schema.sql`** e **`painel/drizzle/`** — schema do banco (7 tabelas). O nome da pasta
  é histórico; o banco é Neon (Postgres puro).
- **`.claude/skills/prazos-cpc/`** — skill que ancora a classificação do ato ao RITO (cível,
  penal, trabalhista, juizado, recuperação judicial, execução fiscal, prazo material).
- **`docs/01_APIS_JUDICIARIO.md`** — pesquisa das APIs do judiciário e requisitos de acesso.
- **`CLAUDE.md`** — contexto do escritório para o agente.

## Fontes de dados (ver `docs/01_APIS_JUDICIARIO.md`)

- **DataJud (CNJ)** — metadados e movimentações. Gratuito, chave pública embutida. Testado ao vivo.
- **Comunica/DJEN (CNJ)** — intimações por OAB, com inteiro teor. Gratuito. Fonte oficial dos prazos.
  Atenção: chamadas de servidor podem tomar 403 (Cloudflare); ver o doc para os fallbacks.
- **Documentos dos autos** — camada paga (Judit/Escavador) ou MNI com certificado. Fase 2.

## Setup

Pré-requisitos: Node 20+, pnpm, uma conta Neon e uma conta Vercel.

### 1. Banco (Neon)
1. Crie um projeto no Neon e copie a connection string (pooled).
2. `cd painel && cp .env.example .env` e cole em `DATABASE_URL`.
3. Rode as migrações: `pnpm db:push` (ou aplique `painel/drizzle/0000_gabinete_init.sql`).

### 2. MCP jurídico
```bash
cd mcp-server
pnpm install
pnpm build
pnpm test        # roda os testes do motor de prazos
```
Configure no Claude Code (arquivo `.mcp.json` do projeto já traz o exemplo). Defina `DATABASE_URL`
no ambiente para persistir. Sem banco, o MCP ainda consulta DataJud e Comunica.

### 3. Painel
```bash
cd painel
pnpm install
pnpm dev         # http://localhost:3000
```
Deploy no Vercel: importe o repositório, defina `DATABASE_URL` nas env vars, deploy.

## Uso (modelo sob comando)

No terminal, com o Claude Code e o MCP ativos:

- "adiciona o processo 1002345-67.2026.8.26.0100 do cliente Marlene"
- "puxa minhas intimações de hoje" → grava as comunicações e sugere prazos
- "o que vence esta semana?" → `listar_prazos`
- "analisa a contestação do processo da Marlene e me dá os pontos fracos"

O advogado confirma/edita cada prazo no painel (amarelo → verde). A partir daí é palavra final.

## A fronteira

O sistema coleta, organiza, analisa e sugere prazos. **Não peticiona, não decide, não é
consultoria.** Para na informação pronta para agir. Peticionar e assinar é do advogado.

## Custo

Sob comando: motor = a própria assinatura Claude do advogado; APIs do CNJ gratuitas; Neon e Vercel
no free tier no começo. Automação (coleta de madrugada) é Fase 2/3 e usa API key (ver documento
mestre da mentoria).
