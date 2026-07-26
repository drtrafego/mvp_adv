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

import { readFileSync } from "node:fs";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Carrega o .env do mcp-server quando a variável não veio do ambiente.
 *
 * Necessário porque o `.mcp.json` declara `"DATABASE_URL": "${DATABASE_URL}"`, que só é
 * substituído se a variável existir no shell que abriu o Claude Code. Sem isso o servidor subia
 * com a string literal "${DATABASE_URL}" e TODA tool de banco falhava. Mesmo mecanismo que os
 * scripts de coleta já usavam.
 */
function carregarEnvLocal(): void {
  const faltando = (v?: string) => !v || v.startsWith("${");
  if (!faltando(process.env.DATABASE_URL) && !faltando(process.env.OAB_ADVOGADO)) return;
  try {
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const linha of env.split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && faltando(process.env[m[1]])) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Sem .env: segue com o que veio do ambiente. bancoConfigurado() trata a ausência.
  }
}
carregarEnvLocal();

import { consultarProcesso } from "./lib/datajud.js";
import { buscarIntimacoes, oabsDoAmbiente } from "./lib/comunica.js";
import { parseOab, type IdentidadeOab } from "./lib/oab.js";
import { autocadastrarDeComunicacoes } from "./lib/auto-cadastro.js";
import { calcularPrazo } from "./lib/prazos.js";
import {
  CATALOGO_PRAZOS,
  CHAVES_ATO,
  ROTULO_RITO,
  buscarAto,
} from "./lib/catalogo-prazos.js";
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
  processosSemCliente,
  definirClienteProcesso,
  buscarModelos,
  salvarModelo,
  salvarPeca,
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
 * Rodapé informativo de "quando foi a última coleta". Nunca derruba a operação principal, mas
 * também não finge que está tudo bem: se a consulta falhar, diz que falhou.
 */
async function rodapeSincronizacao(rotulo: string, fonte: string): Promise<string> {
  try {
    return formatarSincronizacao(rotulo, await ultimaSincronizacao(fonte));
  } catch (e) {
    return `Última sincronização ${rotulo}: ⚠️ não foi possível consultar (${(e as Error).message}).`;
  }
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
      const rodape = `\n\n${await rodapeSincronizacao("DJEN", "djen")}`;
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
      "Calcula a data fatal de um prazo de forma determinística. VOCÊ classifica o ATO (escolhe " +
      "a chave em ato_chave); o código deriva os dias, o regime de contagem (úteis ou corridos) e " +
      "a suspensão aplicável ao rito, e calcula a data. NÃO existe prazo padrão de 15 dias: no " +
      "penal a contagem é corrida e não para no recesso (CPP art. 798), na recuperação judicial é " +
      "corrida (Lei 11.101 art. 189 §1º I), no trabalhista o recurso é de 8 dias (CLT art. 775), " +
      "no juizado o recurso inominado é de 10 dias, e quando a lei silencia o prazo é de 5 dias " +
      "(CPC art. 218 §3º, chave 'manifestacao-generica'). Use 'dias' avulso apenas quando o juiz " +
      "fixar prazo diverso do legal. Se informar processo e ato, grava como prazo SUGERIDO " +
      "(amarelo) para o advogado confirmar.",
    inputSchema: {
      data_disponibilizacao: z.string().describe("Data de disponibilização no DJEN, YYYY-MM-DD."),
      ato_chave: z
        .enum(CHAVES_ATO)
        .optional()
        .describe(
          "Chave do ato no catálogo por rito. É o caminho correto: define dias, contagem e " +
            "suspensão. Se não identificar o ato e a lei silenciar, use 'manifestacao-generica' " +
            "(5 dias, CPC art. 218 §3º), nunca 15 dias.",
        ),
      dias: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Só quando o ato não está no catálogo ou o juiz fixou prazo diverso do legal. " +
            "Sobrepõe o catálogo e gera alerta de conferência.",
        ),
      contagem: z
        .enum(["uteis", "corridos"])
        .optional()
        .describe("Sobrepõe a contagem do rito. Use apenas com justificativa."),
      dobro: z.boolean().optional().describe("Aplica prazo em dobro (Fazenda, MP, Defensoria, litisconsortes em autos físicos)."),
      data_publicacao_conhecida: z
        .string()
        .optional()
        .describe(
          "Publicação já conhecida (ciência pessoal, carga dos autos). Em prazo material é a " +
            "data da CIÊNCIA do ato, e é obrigatória.",
        ),
      ato: z.string().optional().describe("Descrição livre do ato, para gravar no painel."),
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
        atoChave: a.ato_chave,
        dias: a.dias,
        contagem: a.contagem,
        dobro: a.dobro,
        dataPublicacaoConhecida: a.data_publicacao_conhecida,
        calendario: { feriadosForenses },
      });
      const doCatalogo = a.ato_chave ? buscarAto(a.ato_chave) : undefined;
      const rotuloAto = a.ato ?? doCatalogo?.rotulo ?? "Prazo";
      let gravado = "";
      if (a.persistir && bancoConfigurado()) {
        const { id } = await inserirPrazoSugerido({
          processoId: a.processo_id ?? null,
          ato: rotuloAto,
          regraAplicada: [r.dispositivo, r.dobro ? "prazo em dobro" : null]
            .filter(Boolean)
            .join(" | ") || undefined,
          calculo: r,
        });
        gravado = `\n\n💾 Gravado como prazo SUGERIDO (id ${id}). Confirme no painel para virar humana.`;
      }
      const cabecalhoRito = r.rito ? ` — rito ${ROTULO_RITO[r.rito]}` : "";
      const base = r.dispositivo ? `\nBase: ${r.dispositivo}${r.fonte ? ` (${r.fonte})` : ""}` : "";
      const pendencias = r.alertas.length
        ? `\n\nPendências para o advogado:\n${r.alertas.map((x) => "  ⚠️ " + x).join("\n")}`
        : "";
      return texto(
        `⏱️ ${rotuloAto}${r.dobro ? " (em dobro)" : ""}${cabecalhoRito}\n` +
          `Disponibilização: ${r.dataDisponibilizacao ?? "-"}\n` +
          `Publicação: ${r.dataPublicacao}\nInício da contagem: ${r.dataInicioContagem}\n` +
          `➡️ DATA FATAL: ${r.dataFatal} (${r.diasEfetivos} dias ${r.contagem})` +
          base +
          `\n\nMemória de cálculo:\n${r.memoria.map((m) => "  - " + m).join("\n")}` +
          pendencias +
          gravado,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// catalogo_prazos — a IA consulta os atos e regras de cada rito antes de classificar
// ---------------------------------------------------------------------------
server.registerTool(
  "catalogo_prazos",
  {
    title: "Catálogo de prazos por rito",
    description:
      "Lista os atos processuais do catálogo com prazo, regime de contagem e dispositivo legal. " +
      "Consulte antes de classificar uma intimação, para escolher a chave certa em calcular_prazo.",
    inputSchema: {
      rito: z
        .enum(["civel", "penal", "trabalhista", "jec", "recuperacao", "fiscal", "material"])
        .optional()
        .describe("Filtra por rito. Sem filtro, devolve o catálogo inteiro."),
      busca: z.string().optional().describe("Filtra por termo no rótulo, chave ou sinônimos."),
    },
  },
  async ({ rito, busca }) => {
    const termo = busca?.toLowerCase().trim();
    const itens = CATALOGO_PRAZOS.filter((x) => {
      if (rito && x.rito !== rito) return false;
      if (!termo) return true;
      return (
        x.chave.includes(termo) ||
        x.rotulo.toLowerCase().includes(termo) ||
        x.sinonimos.some((s) => s.toLowerCase().includes(termo))
      );
    });
    if (itens.length === 0) return texto("Nenhum ato no filtro informado.");
    const porRito = new Map<string, typeof itens>();
    for (const i of itens) {
      const lista = porRito.get(i.rito) ?? [];
      lista.push(i);
      porRito.set(i.rito, lista);
    }
    const blocos = [...porRito.entries()].map(([r, lista]) => {
      const linhas = lista.map(
        (i) =>
          `  • ${i.chave} — ${i.rotulo}: ${i.dias} dia(s) ${i.contagem === "uteis" ? "úteis" : "CORRIDOS"} ` +
          `(${i.dispositivo})` +
          (i.dobroAdmitido ? "" : " | não admite dobro") +
          (i.aplicaRecesso ? "" : " | recesso 20/12-20/01 não incide") +
          (i.conferir ? `\n      ⚠️ ${i.conferir}` : ""),
      );
      return `${ROTULO_RITO[r as keyof typeof ROTULO_RITO].toUpperCase()}\n${linhas.join("\n")}`;
    });
    return texto(
      blocos.join("\n\n") +
        "\n\nSem ato identificado e lei silente: 'manifestacao-generica' (5 dias, CPC art. 218 §3º).",
    );
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
      "(máquina); o advogado revisa e tem a palavra final. Ligada ao processo pelo número CNJ.\n\n" +
      "EXIGÊNCIA DE QUALIDADE: análise que só resume não serve. Diga de que lado o cliente está e " +
      "o que o ato provoca PARA ELE; nomeie o ato processual cabível com o dispositivo (não " +
      "'avaliar o cabimento de recurso'); se abre prazo, calcule a data fatal com calcular_prazo " +
      "antes e informe aqui; e diga o que acontece se o advogado não agir. Cada ponto traz " +
      "informação nova, com o trecho do documento que a sustenta.",
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
      posicao_cliente: z
        .string()
        .optional()
        .describe(
          "Polo do cliente no processo (ex.: 'exequente', 'executado', 'réu'). Sem isso não dá " +
            "para dizer se a decisão é boa ou ruim para ele. Se o documento não permitir saber, " +
            "escreva 'não identificado no documento'.",
        ),
      resumo: z.string().describe("O que o documento decidiu ou determinou, em linguagem direta."),
      acao_necessaria: z
        .string()
        .optional()
        .describe(
          "O ato concreto a praticar, nomeado, com o dispositivo. Ex.: 'Agravo de instrumento " +
            "(CPC art. 1.015, II)'. Não use fórmula vazia como 'avaliar o cabimento'.",
        ),
      prazo: z
        .string()
        .optional()
        .describe(
          "Prazo do ato, com a data fatal já calculada por calcular_prazo. Ex.: '15 dias úteis, " +
            "fatal 18/08/2026'. Nunca escreva data que não veio da tool.",
        ),
      consequencia: z
        .string()
        .optional()
        .describe(
          "O que acontece se o advogado NÃO agir (preclusão, trânsito em julgado, multa, " +
            "penhora). É o que transforma a análise em decisão.",
        ),
      severidade: z
        .enum(["critico", "alto", "medio", "baixo"])
        .optional()
        .describe("Gravidade do risco, conforme a skill saida-forense."),
      pontos: z
        .array(z.string())
        .optional()
        .describe("Pontos-chave. Cada um traz informação NOVA, não repete o resumo."),
      trecho_fonte: z
        .string()
        .optional()
        .describe("Trecho literal do documento que sustenta a conclusão principal."),
      atencao: z.string().optional().describe("Alerta ou risco a destacar."),
    },
  },
  async ({
    numero_cnj,
    tipo,
    tipo_ato,
    resultado,
    posicao_cliente,
    resumo,
    acao_necessaria,
    prazo,
    consequencia,
    severidade,
    pontos,
    trecho_fonte,
    atencao,
  }) => {
    if (!bancoConfigurado())
      return erro("Banco (Neon) não configurado. Defina DATABASE_URL para salvar análises.");
    try {
      const conteudo = {
        tipo_ato,
        resultado,
        posicao_cliente,
        resumo,
        acao_necessaria,
        prazo: prazo ?? null,
        consequencia,
        severidade,
        pontos,
        trecho_fonte,
        atencao,
      };
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

// buscar_modelos — peças-modelo do escritório de um tipo, base de estrutura/estilo do redator
server.registerTool(
  "buscar_modelos",
  {
    title: "Buscar peças-modelo do escritório",
    description:
      "Retorna as peças-modelo do escritório de um dado tipo (inicial, contestacao, recurso...), " +
      "para o redator usar como base de ESTRUTURA e ESTILO. NUNCA copie citação do modelo: os " +
      "fundamentos vêm verificados pelo pesquisador-juridico. Se não houver modelo, redija do zero.",
    inputSchema: {
      tipo: z.string().describe("Tipo da peça: inicial, contestacao, recurso, manifestacao, etc."),
      tags: z.array(z.string()).optional().describe("Filtro opcional por tags (ex.: área do direito)."),
    },
  },
  async ({ tipo, tags }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado. Defina DATABASE_URL.");
    try {
      const modelos = await buscarModelos({ tipo, tags });
      if (!modelos.length)
        return texto(`Nenhum modelo do tipo "${tipo}" cadastrado. Redija do zero seguindo o CPC.`);
      const lista = modelos
        .map((m, i) => `--- MODELO ${i + 1}: ${m.titulo} (${m.tipo}) ---\n${m.textoExtraido ?? "(sem texto)"}`)
        .join("\n\n");
      return texto(
        `${modelos.length} modelo(s) do tipo "${tipo}". Use como referência de estrutura e estilo, ` +
          `nunca de fundamento (a citação vem do pesquisador-juridico):\n\n${lista}`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// salvar_peca — grava o rascunho de uma peça produzida pelo redator (sugestão, amarelo)
server.registerTool(
  "salvar_peca",
  {
    title: "Salvar rascunho de peça",
    description:
      "Grava no painel o rascunho de uma peça que você (redator) produziu. Nasce como SUGESTÃO " +
      "(máquina, amarelo); o advogado revisa, edita e assina. Se o painel já criou uma peça " +
      "pendente (peca_id), passe-o para preencher aquela linha; senão, uma nova é criada. Só " +
      "grave depois que o revisor-juridico auditar as citações.",
    inputSchema: {
      peca_id: z.string().optional().describe("Id da peça pendente criada pelo painel, se houver."),
      processo_id: z.string().optional().describe("Id do processo (uuid), se ligada a um processo."),
      prazo_id: z.string().optional().describe("Id do prazo (uuid), se gerada a partir de um prazo."),
      cliente_id: z.string().optional().describe("Id do cliente (uuid), útil na inicial de caso novo."),
      tipo: z.string().describe("Tipo da peça: inicial, contestacao, recurso, manifestacao, etc."),
      titulo: z.string().optional().describe("Título curto da peça."),
      conteudo: z.string().describe("O texto do rascunho (já auditado pelo revisor-juridico)."),
      modelo_base_id: z.string().optional().describe("Id do modelo do escritório usado como base."),
    },
  },
  async ({ peca_id, processo_id, prazo_id, cliente_id, tipo, titulo, conteudo, modelo_base_id }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado. Defina DATABASE_URL.");
    try {
      const r = await salvarPeca({
        pecaId: peca_id,
        processoId: processo_id ?? null,
        prazoId: prazo_id ?? null,
        clienteId: cliente_id ?? null,
        tipo,
        titulo,
        conteudo,
        modeloBaseId: modelo_base_id ?? null,
      });
      if (!r)
        return erro(
          "Peça não salva: a linha já foi assumida pelo advogado (humana) e o motor não sobrescreve.",
        );
      return texto(
        `✅ Rascunho de peça salvo no painel (setor Peças). Nasce como sugestão; o advogado revisa e ` +
          `assina. id=${r.id}`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

// ---------------------------------------------------------------------------
// Clientes: quem é a parte de cada processo
//
// O DataJud não devolve as partes, então o nome do cliente não vem da coleta. Ele é lido do
// TEOR da intimação (que traz a qualificação) por VOCÊ, não por regex: regex em texto de
// intimação erra a maior parte e ainda gruda a palavra seguinte no nome.
// ---------------------------------------------------------------------------
server.registerTool(
  "processos_sem_cliente",
  {
    title: "Processos sem cliente identificado",
    description:
      "Lista os processos da carteira que ainda não têm cliente, junto com o teor das intimações " +
      "vinculadas. Leia o teor, identifique a parte que o escritório representa (é a que tem o " +
      "advogado do escritório na qualificação) e grave com definir_cliente. Se o teor não " +
      "permitir concluir com segurança, NÃO invente: deixe para o advogado.",
    inputSchema: {
      limite: z.number().int().positive().max(100).optional().describe("Máximo de processos (padrão 30)."),
    },
  },
  async ({ limite }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      const lista = await processosSemCliente(limite ?? 30);
      if (lista.length === 0) return texto("Todos os processos da carteira já têm cliente definido.");
      const blocos = lista.map((p) => {
        const teor = p.teores.length
          ? p.teores.map((t, i) => `    [intimação ${i + 1}] ${t}`).join("\n")
          : "    (sem intimação vinculada: não há de onde ler as partes)";
        return `  • ${p.numeroCnj} — ${p.classe ?? "classe não informada"}\n${teor}`;
      });
      return texto(
        `${lista.length} processo(s) sem cliente:\n\n${blocos.join("\n\n")}\n\n` +
          `Para cada um que você conseguir identificar, chame definir_cliente. O nome nasce como ` +
          `sugestão: o advogado confere no painel.`,
      );
    } catch (e) {
      return erro((e as Error).message);
    }
  },
);

server.registerTool(
  "definir_cliente",
  {
    title: "Definir o cliente de um processo",
    description:
      "Cadastra o cliente (ou reaproveita um já existente), vincula ao processo com o papel e " +
      "passa a exibir o nome na carteira e nos alertas de prazo. Use o nome COMO ESTÁ no " +
      "documento, sem abreviar nem corrigir.",
    inputSchema: {
      numero_cnj: z.string().describe("Número CNJ do processo já cadastrado na carteira."),
      nome: z.string().describe("Nome da parte, exatamente como consta no documento."),
      papel: z
        .string()
        .describe("Papel no processo: autor, réu, exequente, executado, agravante, impetrante..."),
      documento: z.string().optional().describe("CPF ou CNPJ, se constar no documento."),
    },
  },
  async ({ numero_cnj, nome, papel, documento }) => {
    if (!bancoConfigurado()) return erro("Banco (Neon) não configurado.");
    try {
      const r = await definirClienteProcesso({ numeroCnj: numero_cnj, nome, papel, documento });
      if (!r)
        return erro(
          `Processo ${numero_cnj} não está na carteira. Cadastre com adicionar_processo antes.`,
        );
      return texto(
        `✅ ${nome} vinculado ao processo ${formatarCNJ(numero_cnj)} como ${papel}.\n` +
          `O nome já aparece na carteira, na busca e nos alertas de prazo. Confira no painel.`,
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
