# Panorama de funcionalidades do Gabinete

Sistema jurídico de UM advogado (não SaaS). O advogado comanda pelo celular/terminal
(Claude Code + MCP), tudo grava no Neon, e o painel web é onde ele vê e edita.
Filosofia inegociável: **a máquina propõe, o humano dispõe**.

## 1. Fluxo central (celular → painel)

Princípio que costura tudo: **toda capacidade do backend precisa de um lugar no frontend
para ver e editar.** Onde esse lugar não existe, a capacidade fica "cega".

```
[advogado no celular / tmux no VPS]
      │  "puxa minhas intimações", "calcula o prazo", "analisa a contestação"
      ▼
[Claude Code + MCP gabinete]  (assinatura do advogado é o motor, sem API paga)
      │  aciona uma tool ──► DataJud (metadados) / DJEN (intimações)
      ▼
[Neon Postgres]  (fonte da verdade, 14 tabelas)
      │  dado nasce origem=maquina / status=sugerido  (amarelo)
      ▼
[painel Next.js na Vercel]  (auto-refresh 30s)
      │  advogado confirma/edita ──► origem=humana  (verde, palavra final)
      ▼
[decisão e assinatura ficam com o advogado]
```

## 2. O que JÁ EXISTE (hoje, no ar)

Backend: **14 tools** no MCP. Funcionais: `consultar_processo`, `adicionar_processo`,
`sincronizar_carteira`, `processar_intimacoes`, `calcular_prazo` (motor determinístico
CPC, 8 testes), `listar_prazos`, `confirmar_prazo`, `editar_prazo`, `pesquisar_carteira`,
`registrar_feriado`, `status_sincronizacao`, `reconciliar_intimacoes`.
Parcial: `buscar_intimacoes` (coleta real só de IP Brasil/VPS, DJEN geobloqueia).
Stub: `baixar_autos` (só devolve mensagem; não baixa nada ainda).

Banco: 14 tabelas. Destaque: `analises` (bem modelada, mas **órfã**, sem query nem tela —
a gaveta pronta para documentos e peças) e `documentos` (existe, aba read-only, upload desativado).

Frontend (no ar em https://mvp-adv.vercel.app):
Login, Início, Prazos, Processos, Intimações, Clientes, Configurações, modal do processo
(6 abas: Prazos, Estágio, Timeline, Documentos, Anotações, Cliente). Sidebar por setores,
auth, soft-delete.

## 3. O que FALTA (priorizado)

| # | Frente | Backend novo | Tabela | Painel novo |
|---|---|---|---|---|
| A | Leitura/análise de documentos | tool `analisar_documento` + `salvar_analise` | `analises` (existe) + `documentos` | ativar upload + aba **Análises** editável |
| B | Orientação de defesa | subagente `estrategista-defesa` | `analises` tipo `estrategia_defesa` | card de estratégia no modal |
| C | Argumentos + legislação | tool `pesquisar_legislacao` (RAG 7 códigos) | `normas`, `dispositivos` (pgvector, novas) | bloco de fundamentos legais |
| D | Peças/petições prontas | subagentes `analista-caso`, `redator-inicial` | `pecas` (nova) | setor **Peças** com selo de rascunho |
| E | Coleta contínua no VPS | `comunica-browser` + cron + alertas WhatsApp | `sincronizacoes` (existe) | "saúde da coleta" no dashboard |
| F | Baixar autos por certificado | evoluir `baixar_autos` (MNI/Escavador + A1) | `documentos` | botão "baixar dos autos" |

## 4. A fronteira: "não peticiona" x "peças prontas"

Não é contradição, é enquadramento. A fronteira proíbe o **ato** (protocolar, assinar,
decidir). O usuário quer **matéria-prima** (rascunho que economiza tempo). Conciliação:

> A máquina produz **rascunho assistido**; o ato de peticionar e assinar continua
> exclusivamente do advogado. O sistema nunca protocola, nunca assina, nunca envia.

Regras duras de UI daí decorrentes:
1. Toda peça nasce e permanece **"rascunho sugerido"** (amarelo) até o advogado aprovar (verde).
2. Nenhum botão de "protocolar/enviar/assinar" existe. No máximo "exportar/copiar".
3. Todo texto carrega origem, modelo e aviso de responsabilidade do advogado.
4. O texto da fronteira em Configurações passa a dizer que o sistema também redige rascunhos.

## 5. Ordem de implementação recomendada

- **Fase 5**: Análise de documentos + destravar a tabela `analises` (maior valor, nada externo).
- **Fase 6**: Coleta contínua no VPS + saúde no dashboard + alertas D-5/D-3/D-1.
- **Fase 7**: Legislação RAG (`pesquisar_legislacao`), base para argumentos e peças.
- **Fase 8**: Subagentes forenses + setor Peças (a orientação de defesa e as peças prontas).
- **Fase 9**: Baixar autos por certificado (por último; depende do A1 do Daniel / serviço pago).

Resumo: hoje o Gabinete coleta processos, puxa intimações e gerencia prazos ponta a ponta.
Falta a inteligência jurídica (documentos, defesa, legislação, peças) — que já tem lugar
reservado no banco — mais a automação da coleta no VPS e o acesso a autos por certificado.
