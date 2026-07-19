# Arquitetura da Coleta de Intimações e Documentos

Decisão de arquitetura do coração do Gabinete (intimação + documento). Baseada em testes
empíricos reais. Aprovada em 14/07/2026.

## 0. Correção técnica

O bloqueio da Comunica é **AWS WAF** (não Cloudflare). A tela "The request could not be satisfied"
é do CloudFront. Consequências:
1. O cookie que libera a API é o **`aws-waf-token`**, emitido pelo SDK JavaScript da AWS que roda
   dentro do SPA, não o `cf_clearance`.
2. **FlareSolverr provavelmente não resolve** (é afinado para o desafio da Cloudflare). A saída
   correta é um **navegador real (Playwright) na máquina do advogado**, que carrega o SPA e deixa o
   SDK da AWS emitir o token.
3. O token tem TTL curto (minutos) e é renovado enquanto a página vive. Não adianta colher e reusar
   por dias. O robusto é disparar a chamada à API **de dentro da própria página** (same-origin),
   deixando o navegador anexar cookies e assinatura sozinho.

## A. Matriz: coleta de INTIMAÇÃO

| Método | Confiabilidade | Custo | Fragilidade | Esforço dev | Risco de perder intimação |
|---|---|---|---|---|---|
| FlareSolverr colhe token e reusa | Baixa/média (mira Cloudflare, não AWS WAF) | R$ 0 | Alta | Médio/alto | Médio/alto |
| **Playwright dirigindo o SPA na máquina do advogado** | **Alta** | **R$ 0** | Média | Médio | **Baixo** |
| Baixar e varrer o Diário (DJEN) | Média/baixa p/ um advogado | R$ 0 (banda/disco) | Alta | Alto | Alto (falso negativo) |
| Intermediário pago (Judit/Escavador) | Alta | Pago | Baixa | Baixo | Baixo |

### Recomendação A (aprovada)
- **Principal: Playwright + API por dentro do SPA.** Abre `comunica.pje.jus.br/consulta` na máquina
  do advogado, o SDK do AWS WAF emite o `aws-waf-token`, e a consulta é disparada de dentro da
  página (`page.evaluate` com `fetch` same-origin). JSON limpo, requisição que a AWS aceita.
  Fallback: raspar a tabela do SPA se o fetch interno falhar.
- **Redundância grátis: reconciliação com o DataJud.** Toda intimação vira, com defasagem, uma
  movimentação no DataJud (fonte/transporte/auth diferentes, não compartilha modo de falha). Ato
  intimatório sem comunicação correspondente dispara alerta de "possível intimação não capturada".
- **Contingência paga: Judit/Escavador** atrás de flag, para servidor ou SLA.

Nota histórica: antes da unificação no DJEN (Resoluções CNJ 455/2022 e 569/2024), o caminho grátis
era raspar dezenas de diários estaduais. O CNJ centralizou isso na Comunica e colocou atrás do WAF.
Os sistemas que "fazem há anos" hoje ou rodam navegador headless (nosso método) ou pagam
intermediário. Varrer o caderno nacional é o de maior risco de falso negativo: fica como emergência.

## B. Matriz: DOCUMENTOS / AUTOS

| Método | Cobertura | Custo | Manutenção | Segurança do certificado | Sigiloso |
|---|---|---|---|---|---|
| MNI + A1 próprio | Ampla (tribunal a tribunal) | R$ 0 além do certificado | Alto (SOAP por tribunal) | Ótima (.pfx nunca sai da máquina) | Sim, se habilitado |
| Escavador API v2 (pago) | Ampla | Assinatura + por processo | Baixo (REST) | Exige subir o .pfx (encriptado) | Sim, com A1 enviado |
| Upload manual no painel | O que o advogado baixar | R$ 0 | Baixo | Total | Sim (mais seguro) |

### Recomendação B (aprovada)
- **MVP e padrão: upload manual.** Custo zero, cobre segredo de justiça, nunca expõe credencial.
  Calcula `hash_sha256`, grava em `documentos` com `fonte = "upload"`.
- **Fase 2: Escavador API v2** atrás de `ESCAVADOR_API_KEY`, sempre com
  `documentos_especificos=INICIAIS`, consentimento registrado antes de enviar o A1.
- **Fase 3: MNI direto com A1 local**, só se um tribunal concentrar volume.

Regra dura: sem habilitação do advogado no processo, não há acesso a sigiloso por via nenhuma, nem
paga. O sistema nunca promete o que a lei não permite.

## C. Arquitetura recomendada

Tudo na máquina Windows do advogado (modelo "sob comando"):
- `buscar_intimacoes` → `comunica.ts` tenta fetch direto (barato, às vezes 403) → no 403 delega a
  `comunica-browser.ts` (Playwright, contexto persistente aquecido, `aws-waf-token`,
  `page.evaluate(fetch)` na API, fallback raspar SPA) → `upsertComunicacoes` (dedupe por
  `hash_djen`) → `registrarSincronizacao("djen", ...)`.
- Redundância: `reconciliar_intimacoes` cruza DataJud × `comunicacoes`.
- Documentos: `baixar_autos` com upload manual (padrão), Escavador (Fase 2), MNI (Fase 3), via
  `cert.ts` para o A1.

Persistência (Neon/Drizzle): reusa `processos`, `movimentacoes`, `comunicacoes`, `documentos`,
`prazos`; ganha `sincronizacoes` (nova).

Certificado A1: local primeiro, o `.pfx` nunca vai para o Neon nem para log. Caminho em
`A1_PFX_PATH` (env local). Senha no Windows Credential Manager, nunca em `.env` commitado. MNI usa
mTLS direto do Node ao tribunal. Escavador só após consentimento explícito registrado no banco.

## D. Plano de implementação (para o @dev)

**Passo 1 — tabela `sincronizacoes`** (fonte de verdade do "o que foi coletado e quando"):
```ts
export const sincronizacoes = pgTable("sincronizacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  fonte: text("fonte").notNull(),          // 'djen' | 'datajud'
  escopo: text("escopo"),                  // ex.: 'OAB 11158/MT' ou numero_cnj
  status: text("status").notNull(),        // 'ok' | 'erro' | 'parcial'
  itens: integer("itens").default(0),
  novos: integer("novos").default(0),
  mensagem: text("mensagem"),
  iniciadoEm: timestamp("iniciado_em", { withTimezone: true }).defaultNow(),
  concluidoEm: timestamp("concluido_em", { withTimezone: true }),
}, (t) => ({ idxFonte: index("idx_sinc_fonte").on(t.fonte, t.iniciadoEm) }));
```
Espelhar em `supabase/schema.sql` e `painel/src/db/schema.ts`. Em `db.ts`: `registrarSincronizacao`
e `ultimaSincronizacao`.

**Passo 2 — `comunica-browser.ts`** (`pnpm add playwright` + `playwright install chromium`):
`consultarViaBrowser(params): Promise<ComunicacaoDJEN[]>`:
1. `chromium.launchPersistentContext(userDataDir, { headless: true })`, `userDataDir` fixo (default
   `%LOCALAPPDATA%/gabinete/comunica-profile`), para o token sobreviver entre execuções.
2. `garantirSessao(page)`: navega para `comunica.pje.jus.br/consulta`, espera hidratar e o cookie
   `aws-waf-token` existir, com timeout e 1 retentativa.
3. Chama por dentro da página:
   ```ts
   const items = await page.evaluate(async (url) => {
     const r = await fetch(url, { headers: { Accept: "application/json" } });
     if (!r.ok) throw new Error("HTTP " + r.status);
     return (await r.json()).items ?? [];
   }, url);
   ```
4. Reusa `normalizar()` do `comunica.ts` (exportá-lo).
5. Fallback: preencher o formulário do SPA e raspar a tabela.
6. Fechar o contexto no `finally`.

Retry/falha: até 2 ciclos. Se todos falharem, lançar `ComunicaError(bloqueadoPorWAF=true)`.
**Nunca devolver array vazio quando a coleta falhou** (vazio = "não havia intimação"; falha = erro
visível). Distinção crítica.

**Passo 3 — ligar o fallback no `comunica.ts`.** Fetch direto como 1ª tentativa; no ponto do
`ComunicaError(403)`, `return await consultarViaBrowser(params)`. Exportar `normalizar`.

**Passo 4 — `buscar_intimacoes` grava sincronização.** Sucesso → `registrarSincronizacao("djen",
{status:"ok",...})`; catch → `status:"erro"` antes de devolver o erro. Retorno mostra "Última
sincronização DJEN: <timestamp> (<status>)".

**Passo 5 — tool `status_sincronizacao`.** Lê `ultimaSincronizacao("djen")` e `("datajud")`,
devolve verde/vermelho com horário.

**Passo 6 — `reconciliacao.ts` + tool `reconciliar_intimacoes`.** Cruza movimentações intimatórias
(DataJud) × `comunicacoes`. Sem correspondência → alerta "possível intimação não capturada". Não
cria prazo sozinho (regra de ouro).

**Passo 7 (Fase 2) — `cert.ts` + `escavador.ts`.** `carregarA1()` lê `A1_PFX_PATH` + senha do
Credential Manager, `agenteMtls()`. `baixarAutos(cnj, {documentosEspecificos:"INICIAIS"})` com
`ESCAVADOR_API_KEY`, `sha256`, grava em `documentos` (`fonte="escavador"`). Evoluir a tool
`baixar_autos`: arquivo local → upload; senão Escavador+consentimento; senão mensagem de orientação.

### Resumo de arquivos

| Arquivo | Ação | Fase |
|---|---|---|
| `mcp-server/src/lib/schema.ts` | tabela `sincronizacoes` | 2 |
| `supabase/schema.sql`, `painel/src/db/schema.ts` | espelhar `sincronizacoes` | 2 |
| `mcp-server/src/lib/db.ts` | `registrarSincronizacao`, `ultimaSincronizacao` | 2 |
| `mcp-server/src/lib/comunica-browser.ts` | novo: Playwright evaluate-fetch + fallback DOM | 2 |
| `mcp-server/src/lib/comunica.ts` | exportar `normalizar`; delegar ao browser no 403 | 2 |
| `mcp-server/src/lib/reconciliacao.ts` | novo: DataJud × comunicações | 2 |
| `mcp-server/src/index.ts` | sincronização em `buscar_intimacoes`; tools `status_sincronizacao`, `reconciliar_intimacoes`; evoluir `baixar_autos` | 2 |
| `mcp-server/src/lib/cert.ts` | novo: A1 seguro | 2/3 |
| `mcp-server/src/lib/escavador.ts` | novo: cliente REST v2 | 2 |
| `mcp-server/src/lib/mni.ts` | novo: cliente SOAP por tribunal | 3 |

### Env novas (locais, fora do git)
```
A1_PFX_PATH=            # caminho do .pfx na máquina do advogado (Fase 2/3)
ESCAVADOR_API_KEY=      # camada paga de autos (Fase 2)
JUDIT_API_KEY=          # intimação paga (contingência)
COMUNICA_PROFILE_DIR=   # userDataDir do Playwright (default %LOCALAPPDATA%/gabinete)
```

### Testes antes de dar por pronto
1. `buscar_intimacoes` para OAB 11158/MT e 43972/SC (Daniel) na máquina Windows: fetch direto 403,
   Playwright passa com itens reais.
2. Forçar falha (cortar rede no meio): `sincronizacoes.status="erro"` e erro visível, nunca
   "nenhuma intimação".
3. `reconciliar_intimacoes` num processo com decisão recente: confirmar o alerta.
4. Documentos: Fase 2; no MVP validar só upload manual com `sha256`.
