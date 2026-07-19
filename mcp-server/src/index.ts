#!/usr/bin/env node
/**
 * Gabinete · MCP jurídico
 *
 * Servidor MCP (stdio) que dá ao Claude Code as ferramentas para operar a carteira do
 * advogado: consultar processos (DataJud), puxar intimações (Comunica/DJEN), calcular
 * prazos (motor determinístico) e gravar tudo no Neon, respeitando a regra de ouro
 * (máquina propõe, humano dispõe).
 *
 * Uso: configurado no ~/.claude/mcp.json ou no .mcp.json do projeto como um servidor stdio.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { consultarProcesso } from "./lib/datajud.js";
import { buscarIntimacoes, oabsDoAmbiente } from "./lib/comunica.js";
import { parseOab, type IdentidadeOab } from "./lib/oab.js";
import { autocadastrarDeComunicacoes } from "./lib/auto-cadastro.js";
import { calcularPrazo } from "./lib/prazos.js";
import { formatarCNJ, validarCNJ } from "./lib/cnj.js";
import {
  bancoConfigurado,
  upsertProcesso,
  upsertMovimentacoes,
  upsertComunicacoes,
  salvarAnalise,
  inserirPrazoSugerido,
  confirmarPrazo,
  editarPrazo,
  listarPrazos,
  pesquisarCarteira,
  registrarFeriado,
  carregarFeriadosForenses,
  registrarSincronizacao,
  ultimaSincronizacao,
  type RegistroSincronizacao,
} from "./lib/db.js";
import { reconciliarIntimacoes } from "./lib/reconciliacao.js";

const server = new McpServer({ name: "gabinete", version: "0.1.0" });

function texto(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
function erro(t: string) {
  return { content: [{ type: "text" as const, text: `⚠️ ${t}` }], isError: true };
}

function formatarSincronizacao(fonte: string, reg: RegistroSincronizacao | null): string {
  if (!bancoConfigurado()) return `Última sincronização ${fonte}: sem histórico (banco não configurado).`;
  if (!reg) return `Última sincronização ${fonte}: nenhuma registrada ainda.`;
  const quando = (reg.concluidoEm ?? reg.iniciadoEm)?.toISOString().replace("T", " ").slice(0, 19) ?? "?";
  const marca = reg.status === "ok" ? "🟢" : reg.status === "parcial" ? "🟡" : "🔴";
  const extra = reg.status === "ok" ? `${reg.itens ?? 0} item(ns)` : reg.mensagem ?? "";
  return `Última sincronização ${fonte}: ${marca} ${quando} (${reg.status})${extra ? ` — ${extra}` : ""}`;
}

/**
 * Identidades-alvo do advogado para filtrar as intimações: prefere a env OAB_ADVOGADO (pode
 * ter várias seccionais, ex.: "11158/MT;43972/SC"); se ausente, cai na própria OAB consultada.
 * Vazio = sem filtro (comportamento antigo).
 */
function montarOabsAlvo(numeroOab: string, ufOab: string): IdentidadeOab[] {
  const doAmbiente = oabsDoAmbiente();
  if (doAmbiente.length > 0) return doAmbiente;
  const alvo = parseOab(`${numeroOab}/${ufOab}`);
  return alvo ? [alvo] : [];
}

// ---------------------------------------------------------------------------
// consultar_processo — capa e movimentações do DataJud (não persiste)
// ---------------------------------------------------------------------------
server.registerTool(
  "consultar_processo",
  {
    title: "Consultar processo (DataJud)",
    description:
      "Consulta capa e movimentações de um processo no DataJud pelo número CNJ. Não grava nada; " +
      "use adicionar_processo para consultar E salvar na carteira.",
    inputSchema: {
      numero_cnj: z.string().describe("Número CNJ do processo (com ou sem máscara)."),
      alias_tribunal: z
        .string()
        .optional()
        .describe("Alias do DataJud (ex.: tjsp, trf1, trt2) se o mapeamento automático falhar."),
    },
  },
  async ({ numero_cnj, alias_tribunal }) => {
    try {
      const p = await consultarProcesso(numero_cnj, alias_tribunal);
      if (!p.encontrado)
        return texto(`Processo ${formatarCNJ(numero_cnj)} não encontrado no DataJud (${p.tribunal}).`);
      const ultimas = p.movimentacoes
        .slice(0, 8)
        .map((m) => `  • ${m.dataHora.slice(0, 10)} — ${m.descricao}`)
        .join("\n");
      return texto(
        `📋 ${p.numeroCNJ} (${p.tribunal})\n` +
          `Classe: ${p.classe ?? "-"}\nAssunto: ${p.assunto ?? "-"}\n` +
          `Órgão: ${p.orgaoJulgador ?? "-"} | Grau: ${p.grau ?? "-"}\n` +
          `Ajuizamento: ${p.dataAjuizamento?.slice(0, 10) ?? "-"}\n` +
          `Movimentações: ${p.movimentacoes.length} (últimas)\n${ultimas}`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// adicionar_processo — consulta no DataJud e grava na carteira (Neon)
// ---------------------------------------------------------------------------
server.registerTool(
  "adicionar_processo",
  {
    title: "Adicionar processo à carteira",
    description:
      "Consulta o processo no DataJud e grava (ou atualiza) na carteira (Neon), junto com " +
      "as movimentações. Opcionalmente associa o nome do cliente.",
    inputSchema: {
      numero_cnj: z.string(),
      cliente_nome: z.string().optional(),
      alias_tribunal: z.string().optional(),
    },
  },
  async ({ numero_cnj, cliente_nome, alias_tribunal }) => {
    if (!validarCNJ(numero_cnj))
      return erro(`Número CNJ inválido (dígito verificador não confere): ${numero_cnj}`);
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado; não dá para gravar a carteira.");
    try {
      const p = await consultarProcesso(numero_cnj, alias_tribunal);
      const { id } = await upsertProcesso(p, cliente_nome);
      const novas = await upsertMovimentacoes(id, p.movimentacoes);
      return texto(
        `✓ ${p.numeroCNJ} salvo na carteira${cliente_nome ? ` (cliente: ${cliente_nome})` : ""}.\n` +
          `${p.movimentacoes.length} movimentações no DataJud, ${novas} novas gravadas.`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// sincronizar_carteira — reconsulta todos os processos ativos
// ---------------------------------------------------------------------------
server.registerTool(
  "sincronizar_carteira",
  {
    title: "Sincronizar carteira",
    description:
      "Reconsulta no DataJud todos os processos da carteira (ou os informados) e atualiza as " +
      "movimentações. Traz o que há de novo em cada um.",
    inputSchema: {
      numeros_cnj: z
        .array(z.string())
        .optional()
        .describe("Lista de números CNJ. Se omitido, sincroniza todos os processos ativos."),
    },
  },
  async ({ numeros_cnj }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      let alvos = numeros_cnj ?? [];
      if (alvos.length === 0) {
        const carteira = await pesquisarCarteira("");
        alvos = carteira.filter((p) => p.status === "ativo").map((p) => p.numeroCnj as string);
      }
      if (alvos.length === 0) return texto("Carteira vazia; nada a sincronizar.");
      const linhas: string[] = [];
      for (const num of alvos) {
        try {
          const p = await consultarProcesso(num);
          const { id } = await upsertProcesso(p);
          const novas = await upsertMovimentacoes(id, p.movimentacoes);
          linhas.push(`  • ${p.numeroCNJ}: ${novas} nova(s)`);
        } catch (e) {
          linhas.push(`  • ${formatarCNJ(num)}: erro (${(e as Error).message.slice(0, 60)})`);
        }
      }
      return texto(`🔄 Sincronização concluída (${alvos.length} processos):\n${linhas.join("\n")}`);
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// buscar_intimacoes — Comunica/DJEN por OAB
// ---------------------------------------------------------------------------
server.registerTool(
  "buscar_intimacoes",
  {
    title: "Buscar intimações (DJEN)",
    description:
      "Puxa as intimações/publicações do advogado na Comunica/DJEN por OAB e período. Se o " +
      "banco estiver configurado, grava as novas comunicações.",
    inputSchema: {
      numero_oab: z.string().describe("Número da OAB (só dígitos)."),
      uf_oab: z.string().describe("UF da OAB (ex.: SP, BA)."),
      data_inicio: z.string().optional().describe("YYYY-MM-DD"),
      data_fim: z.string().optional().describe("YYYY-MM-DD"),
      sigla_tribunal: z.string().optional(),
      persistir: z.boolean().optional().describe("Gravar as comunicações no Neon (padrão true)."),
    },
  },
  async ({ numero_oab, uf_oab, data_inicio, data_fim, sigla_tribunal, persistir }) => {
    const escopo = `OAB ${numero_oab}/${uf_oab.toUpperCase()}`;
    try {
      const comuns = await buscarIntimacoes({
        numeroOab: numero_oab,
        ufOab: uf_oab,
        dataInicio: data_inicio,
        dataFim: data_fim,
        siglaTribunal: sigla_tribunal,
        oabsAlvo: montarOabsAlvo(numero_oab, uf_oab),
      });
      let gravadas = 0;
      if ((persistir ?? true) && bancoConfigurado() && comuns.length > 0) {
        gravadas = await upsertComunicacoes(comuns);
      }
      await registrarSincronizacao("djen", {
        escopo,
        status: "ok",
        itens: comuns.length,
        novos: gravadas,
        mensagem: comuns.length === 0 ? "sem intimação no período" : undefined,
      });
      const rodape = `\n\n${formatarSincronizacao("DJEN", await ultimaSincronizacao("djen"))}`;
      if (comuns.length === 0) return texto("Nenhuma intimação no período informado." + rodape);
      const lista = comuns
        .slice(0, 15)
        .map(
          (c) =>
            `  • ${c.dataDisponibilizacao ?? "?"} — ${c.siglaTribunal ?? "?"} — ${c.tipoComunicacao ?? "?"}\n` +
            `    Proc: ${c.numeroProcesso ?? "-"}\n` +
            `    ${c.texto.replace(/\s+/g, " ").slice(0, 160)}...`,
        )
        .join("\n");
      return texto(
        `📨 ${comuns.length} intimação(ões)${gravadas ? `, ${gravadas} nova(s) gravadas` : ""}:\n${lista}` + rodape,
      );
    } catch (e) {
      await registrarSincronizacao("djen", {
        escopo,
        status: "erro",
        itens: 0,
        mensagem: (e as Error).message.slice(0, 300),
      });
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// processar_intimacoes — busca as intimações e auto-cadastra os processos (sob comando)
// ---------------------------------------------------------------------------
server.registerTool(
  "processar_intimacoes",
  {
    title: "Processar intimações (auto-cadastro)",
    description:
      "Roda SOB COMANDO: busca as intimações do advogado no DJEN (reusa buscar_intimacoes, com " +
      "o mesmo filtro por identidade da OAB), grava as comunicações e, para cada uma com número " +
      "de processo válido, cadastra o processo na carteira via DataJud (se ainda não existir) e " +
      "vincula a comunicação. NÃO cria prazo (isso é do fluxo prazos-cpc).",
    inputSchema: {
      numero_oab: z.string().describe("Número da OAB (só dígitos)."),
      uf_oab: z.string().describe("UF da OAB (ex.: MT, SC)."),
      data_inicio: z.string().optional().describe("YYYY-MM-DD"),
      data_fim: z.string().optional().describe("YYYY-MM-DD"),
      sigla_tribunal: z.string().optional(),
    },
  },
  async ({ numero_oab, uf_oab, data_inicio, data_fim, sigla_tribunal }) => {
    if (!bancoConfigurado())
      return erro("Banco (Neon) não configurado; o auto-cadastro precisa da carteira para gravar e vincular.");
    const escopo = `OAB ${numero_oab}/${uf_oab.toUpperCase()}`;
    try {
      const comuns = await buscarIntimacoes({
        numeroOab: numero_oab,
        ufOab: uf_oab,
        dataInicio: data_inicio,
        dataFim: data_fim,
        siglaTribunal: sigla_tribunal,
        oabsAlvo: montarOabsAlvo(numero_oab, uf_oab),
      });
      const gravadas = comuns.length > 0 ? await upsertComunicacoes(comuns) : 0;
      const { criados, vinculados } = await autocadastrarDeComunicacoes(comuns);
      await registrarSincronizacao("djen", {
        escopo,
        status: "ok",
        itens: comuns.length,
        novos: gravadas,
        mensagem: `auto-cadastro: ${criados} processo(s) novo(s), ${vinculados} vinculada(s)`,
      });
      return texto(
        `⚙️ ${comuns.length} intimação(ões) processada(s) (${escopo})\n` +
          `  • ${gravadas} comunicação(ões) nova(s) gravada(s)\n` +
          `  • ${criados} processo(s) novo(s) cadastrado(s) na carteira\n` +
          `  • ${vinculados} comunicação(ões) vinculada(s) a processo\n\n` +
          `Nenhum prazo foi criado: use o fluxo prazos-cpc + calcular_prazo para isso.`,
      );
    } catch (e) {
      await registrarSincronizacao("djen", {
        escopo,
        status: "erro",
        itens: 0,
        mensagem: (e as Error).message.slice(0, 300),
      });
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// calcular_prazo — motor determinístico (IA classifica, código calcula)
// ---------------------------------------------------------------------------
server.registerTool(
  "calcular_prazo",
  {
    title: "Calcular prazo",
    description:
      "Calcula a data fatal de um prazo de forma determinística (dias úteis CPC art. 219, " +
      "recesso art. 220, publicação Lei 11.419). VOCÊ classifica o ato (quantos dias, se em dobro); " +
      "o código calcula a data. Se informar processo e ato, grava como prazo SUGERIDO (amarelo) " +
      "para o advogado confirmar.",
    inputSchema: {
      data_disponibilizacao: z.string().describe("Data de disponibilização no DJEN, YYYY-MM-DD."),
      dias: z.number().int().positive().describe("Número de dias do prazo (antes de dobro)."),
      contagem: z.enum(["uteis", "corridos"]).optional(),
      dobro: z.boolean().optional().describe("Aplica prazo em dobro (Fazenda, MP, litisconsortes...)."),
      data_publicacao_conhecida: z.string().optional(),
      ato: z.string().optional().describe("Descrição do ato (ex.: 'Contestação', 'Apelação')."),
      tribunal: z.string().optional().describe("Sigla do tribunal, para carregar feriados forenses locais."),
      processo_id: z.string().optional().describe("ID do processo no Neon, para vincular o prazo."),
      persistir: z.boolean().optional().describe("Gravar como prazo sugerido (padrão false)."),
    },
  },
  async (a) => {
    try {
      const feriadosForenses = a.tribunal ? await carregarFeriadosForenses(a.tribunal) : [];
      const r = calcularPrazo({
        dataDisponibilizacao: a.data_disponibilizacao,
        dias: a.dias,
        contagem: a.contagem,
        dobro: a.dobro,
        dataPublicacaoConhecida: a.data_publicacao_conhecida,
        calendario: { feriadosForenses },
      });
      let gravado = "";
      if (a.persistir && a.ato && bancoConfigurado()) {
        const { id } = await inserirPrazoSugerido({
          processoId: a.processo_id ?? null,
          ato: a.ato,
          regraAplicada: a.dobro ? "prazo em dobro" : undefined,
          calculo: r,
        });
        gravado = `\n\n💾 Gravado como prazo SUGERIDO (id ${id}). Confirme no painel para virar humana.`;
      }
      return texto(
        `⏱️ ${a.ato ?? "Prazo"}${a.dobro ? " (em dobro)" : ""}\n` +
          `Disponibilização: ${r.dataDisponibilizacao ?? "-"}\n` +
          `Publicação: ${r.dataPublicacao}\nInício da contagem: ${r.dataInicioContagem}\n` +
          `➡️ DATA FATAL: ${r.dataFatal} (${r.diasEfetivos} dias ${r.contagem})\n\n` +
          `Memória de cálculo:\n${r.memoria.map((m) => "  - " + m).join("\n")}` +
          gravado,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// listar_prazos — "o que vence esta semana?"
// ---------------------------------------------------------------------------
server.registerTool(
  "listar_prazos",
  {
    title: "Listar prazos",
    description: "Lista prazos por janela de data e status. Ex.: o que vence até tal data.",
    inputSchema: {
      ate: z.string().optional().describe("YYYY-MM-DD, limite superior da data fatal."),
      desde: z.string().optional().describe("YYYY-MM-DD, limite inferior."),
      status: z.enum(["sugerido", "confirmado", "editado", "cancelado"]).optional(),
    },
  },
  async ({ ate, desde, status }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      const prazos = await listarPrazos({ ate, desde, status });
      if (prazos.length === 0) return texto("Nenhum prazo no filtro.");
      const lista = prazos
        .map((p: any) => {
          const marca = p.origem === "humana" ? "🟢" : "🟡";
          const proc = p.numeroCnj ?? p.processoId ?? "-";
          const cli = p.clienteNome ? ` (${p.clienteNome})` : "";
          return `  ${marca} ${p.dataFatal} — ${p.ato} — ${proc}${cli} [${p.status}]  id:${p.id}`;
        })
        .join("\n");
      return texto(`📅 ${prazos.length} prazo(s):\n${lista}\n\n🟡 sugerido (máquina) · 🟢 confirmado/editado (humano)`);
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// confirmar_prazo / editar_prazo — a regra de ouro em ação
// ---------------------------------------------------------------------------
server.registerTool(
  "confirmar_prazo",
  {
    title: "Confirmar prazo",
    description: "Marca um prazo como confirmado e origem humana. O motor não sobrescreve mais.",
    inputSchema: {
      prazo_id: z.string(),
      editor: z.string().optional().describe("Quem confirmou (padrão: advogado)."),
    },
  },
  async ({ prazo_id, editor }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      await confirmarPrazo(prazo_id, editor ?? "advogado");
      return texto(`🟢 Prazo ${prazo_id} confirmado (origem humana). Virou palavra final.`);
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

server.registerTool(
  "editar_prazo",
  {
    title: "Editar prazo",
    description:
      "Altera a data fatal e/ou o ato de um prazo, marcando origem humana. Use quando o advogado " +
      "diverge do cálculo sugerido.",
    inputSchema: {
      prazo_id: z.string(),
      data_fatal: z.string().optional().describe("Nova data fatal, YYYY-MM-DD."),
      ato: z.string().optional(),
      status: z.enum(["confirmado", "editado", "cancelado"]).optional(),
      editor: z.string().optional(),
    },
  },
  async ({ prazo_id, data_fatal, ato, status, editor }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      await editarPrazo(prazo_id, { dataFatal: data_fatal, ato, status }, editor ?? "advogado");
      return texto(`🟢 Prazo ${prazo_id} editado (origem humana).`);
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// pesquisar_carteira / registrar_feriado
// ---------------------------------------------------------------------------
server.registerTool(
  "pesquisar_carteira",
  {
    title: "Pesquisar carteira",
    description: "Busca processos por nome do cliente ou número CNJ.",
    inputSchema: { termo: z.string() },
  },
  async ({ termo }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      const r = await pesquisarCarteira(termo);
      if (r.length === 0) return texto(`Nada encontrado para "${termo}".`);
      const lista = r
        .map((p) => `  • ${p.numeroCnj} — ${p.clienteNome ?? "-"} — ${p.classe ?? "-"} [${p.status}]  id:${p.id}`)
        .join("\n");
      return texto(`🔎 ${r.length} resultado(s):\n${lista}`);
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

server.registerTool(
  "registrar_feriado",
  {
    title: "Registrar feriado forense",
    description:
      "Registra uma suspensão/feriado forense de um tribunal, que passa a entrar no cálculo de prazos.",
    inputSchema: {
      tribunal: z.string().describe("Sigla do tribunal (ex.: TJSP)."),
      data: z.string().describe("YYYY-MM-DD."),
      descricao: z.string().optional(),
      tipo: z.string().optional().describe("feriado | suspensao | recesso"),
    },
  },
  async ({ tribunal, data, descricao, tipo }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      await registrarFeriado(tribunal, data, descricao, tipo ?? "feriado");
      return texto(`✓ Feriado forense registrado: ${tribunal} em ${data}.`);
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// status_sincronizacao — saúde da coleta (DJEN e DataJud)
// ---------------------------------------------------------------------------
server.registerTool(
  "status_sincronizacao",
  {
    title: "Status da sincronização",
    description:
      "Mostra a última coleta de cada fonte (DJEN e DataJud): quando rodou e se foi ok, parcial " +
      "ou erro. Serve para saber se a captação de intimações está saudável.",
    inputSchema: {},
  },
  async () => {
    if (!bancoConfigurado())
      return texto(
        "Banco (Neon) não configurado; não há histórico de sincronização persistido. " +
          "As consultas ao DJEN e ao DataJud seguem funcionando sob demanda.",
      );
    try {
      const [djen, datajud] = await Promise.all([
        ultimaSincronizacao("djen"),
        ultimaSincronizacao("datajud"),
      ]);
      return texto(
        `🩺 Saúde da coleta\n${formatarSincronizacao("DJEN", djen)}\n${formatarSincronizacao("DataJud", datajud)}`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// reconciliar_intimacoes — redundância grátis: DataJud × Comunica (só alerta)
// ---------------------------------------------------------------------------
server.registerTool(
  "reconciliar_intimacoes",
  {
    title: "Reconciliar intimações (DataJud × DJEN)",
    description:
      "Cruza os atos intimatórios das movimentações do DataJud com as comunicações capturadas no " +
      "DJEN. Ato intimatório sem comunicação correspondente vira alerta de POSSÍVEL intimação não " +
      "capturada. Nunca cria prazo sozinho: só avisa para o advogado conferir.",
    inputSchema: {
      numero_cnj: z.string().optional().describe("Limita a um processo. Se omitido, varre a carteira."),
      desde: z.string().optional().describe("YYYY-MM-DD: só movimentações a partir desta data."),
    },
  },
  async ({ numero_cnj, desde }) => {
    if (!bancoConfigurado())
      return erro(
        "Banco (Neon) não configurado. A reconciliação cruza dados já persistidos (movimentações do " +
          "DataJud e comunicações do DJEN); sem banco não há o que reconciliar.",
      );
    try {
      const r = await reconciliarIntimacoes({ numeroCnj: numero_cnj, desde });
      if (r.alertas.length === 0)
        return texto(
          `✅ Reconciliação ok: ${r.intimatorias} ato(s) intimatório(s) de ${r.analisadas} ` +
            `movimentação(ões) têm comunicação correspondente no DJEN. Nenhum alerta.`,
        );
      const lista = r.alertas
        .slice(0, 30)
        .map(
          (a) =>
            `  ⚠️ ${a.dataMovimentacao} — ${a.numeroCnj}${a.clienteNome ? ` (${a.clienteNome})` : ""}\n` +
            `     Movimento: ${a.movimentacao}\n     Motivo: ${a.motivo}`,
        )
        .join("\n");
      return texto(
        `🚨 ${r.alertas.length} possível(is) intimação(ões) NÃO capturada(s) ` +
          `(${r.intimatorias} intimatórias de ${r.analisadas} movimentações):\n${lista}\n\n` +
          `Isto é só um alerta: confira no processo e, se for o caso, busque a intimação no DJEN. ` +
          `Nenhum prazo foi criado automaticamente.`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// baixar_autos — camada paga (Fase 2), stub honesto
// ---------------------------------------------------------------------------
server.registerTool(
  "baixar_autos",
  {
    title: "Baixar autos (camada paga)",
    description:
      "Baixa PDFs dos autos. Requer intermediário pago (Judit/Escavador) ou MNI com certificado; " +
      "é a camada de documentos (Fase 2). No MVP, use upload manual no painel.",
    inputSchema: { numero_cnj: z.string(), documento: z.string().optional() },
  },
  async () =>
    texto(
      "A camada de documentos é da Fase 2 (Judit/Escavador com API key, ou MNI com certificado " +
        "ICP-Brasil do advogado habilitado). No MVP, arraste o PDF no painel ou aponte o arquivo " +
        "local para analisar. Configure JUDIT_API_KEY ou ESCAVADOR_API_KEY para habilitar.",
    ),
);

// ---------------------------------------------------------------------------
// salvar_analise — grava a análise de uma intimação/documento (Fase 5)
// ---------------------------------------------------------------------------
server.registerTool(
  "salvar_analise",
  {
    title: "Salvar análise de documento/intimação",
    description:
      "Grava no painel a análise de uma intimação ou documento. Você (Claude) lê o teor, produz a " +
      "análise estruturada e chama esta ferramenta para persistir. A análise nasce como SUGESTÃO " +
      "(máquina); o advogado revisa e tem a palavra final. Ligada ao processo pelo número CNJ.",
    inputSchema: {
      numero_cnj: z.string().describe("Número CNJ do processo já cadastrado na carteira."),
      tipo: z
        .string()
        .default("analise_documento")
        .describe("Tipo da análise: analise_intimacao, analise_documento, estrategia_defesa, etc."),
      tipo_ato: z.string().optional().describe("Natureza do ato analisado (ex.: 'Decisão', 'Sentença')."),
      resultado: z
        .enum(["favoravel", "desfavoravel", "neutro"])
        .optional()
        .describe("Como o ato impacta o cliente."),
      resumo: z.string().describe("Resumo objetivo do que o documento diz."),
      acao_necessaria: z.string().optional().describe("O que o advogado precisa fazer, se algo."),
      prazo: z.string().optional().describe("Prazo mencionado, se houver (ex.: '5 dias úteis')."),
      pontos: z.array(z.string()).optional().describe("Pontos-chave, um por item."),
      atencao: z.string().optional().describe("Alerta ou risco a destacar."),
    },
  },
  async ({ numero_cnj, tipo, tipo_ato, resultado, resumo, acao_necessaria, prazo, pontos, atencao }) => {
    if (!bancoConfigurado())
      return erro("Banco (Neon) não configurado. Defina DATABASE_URL para salvar análises.");
    try {
      const conteudo = { tipo_ato, resultado, resumo, acao_necessaria, prazo: prazo ?? null, pontos, atencao };
      const r = await salvarAnalise({ numeroCnj: numero_cnj, tipo, conteudo, modelo: "claude (análise assistida)" });
      if (!r)
        return erro(
          `Processo ${formatarCNJ(numero_cnj)} não está na carteira. Cadastre com adicionar_processo antes de analisar.`,
        );
      return texto(
        `✅ Análise salva no painel (setor Análises) para ${formatarCNJ(numero_cnj)}. ` +
          `Nasce como sugestão; o advogado revisa e confirma. id=${r.id}`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log no stderr (stdout é o canal do protocolo MCP)
  console.error(
    `Gabinete MCP no ar. Banco: ${bancoConfigurado() ? "configurado" : "ausente (só DataJud/Comunica)"}.`,
  );
}

main().catch((e) => {
  console.error("Falha ao iniciar o Gabinete MCP:", e);
  process.exit(1);
});
