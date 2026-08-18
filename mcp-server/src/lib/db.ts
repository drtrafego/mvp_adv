/**
 * Camada de persistência no Neon (Postgres) via Drizzle ORM.
 *
 * A "regra de ouro" do Gabinete vive aqui: dado nasce 'maquina' (sugerido). Quando o advogado
 * confirma ou edita, vira 'humana' e o motor NUNCA mais sobrescreve.
 *
 * O banco é opcional: sem DATABASE_URL, as tools que dependem dele avisam com clareza, mas o
 * MCP segue rodando para consultas ao DataJud e à Comunica.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { and, desc, eq, gte, ilike, isNull, lte, ne, or, sql } from "drizzle-orm";
import * as schema from "./schema.js";
import type { ProcessoDataJud } from "./datajud.js";
import type { ComunicacaoDJEN } from "./comunica.js";
import type { CalcularPrazoResult } from "./prazos.js";
import { canonicalOab } from "./oab.js";
import { formatarCNJ } from "./cnj.js";

let db: NeonHttpDatabase<typeof schema> | null = null;

export function bancoConfigurado(): boolean {
  const url = process.env.DATABASE_URL;
  // "${DATABASE_URL}" não substituído pelo .mcp.json conta como NÃO configurado: se passasse
  // adiante, o erro só apareceria lá na frente, disfarçado de "nenhum dado encontrado".
  return Boolean(url) && !url!.startsWith("${");
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!bancoConfigurado()) {
    throw new Error(
      "Banco não configurado. Defina DATABASE_URL (string de conexão do Neon) no ambiente " +
        "ou no arquivo mcp-server/.env para persistir processos, movimentações e prazos.",
    );
  }
  if (!db) {
    const client = neon(process.env.DATABASE_URL as string);
    db = drizzle(client, { schema });
  }
  return db;
}

export async function upsertProcesso(
  p: ProcessoDataJud,
  clienteNome?: string,
): Promise<{ id: string }> {
  const d = getDb();
  const [row] = await d
    .insert(schema.processos)
    .values({
      numeroCnj: p.numeroCNJ,
      tribunal: p.tribunal ?? "?",
      classe: p.classe,
      assunto: p.assunto,
      orgaoJulgador: p.orgaoJulgador,
      valorCausa: p.valorCausa != null ? String(p.valorCausa) : null,
      grau: p.grau,
      ...(clienteNome ? { clienteNome } : {}),
      ultimaSincronizacao: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.processos.numeroCnj,
      set: {
        tribunal: p.tribunal ?? "?",
        classe: p.classe,
        assunto: p.assunto,
        orgaoJulgador: p.orgaoJulgador,
        valorCausa: p.valorCausa != null ? String(p.valorCausa) : null,
        grau: p.grau,
        ...(clienteNome ? { clienteNome } : {}),
        ultimaSincronizacao: new Date(),
      },
    })
    .returning({ id: schema.processos.id });
  return { id: row.id };
}

export async function upsertMovimentacoes(
  processoId: string,
  movs: ProcessoDataJud["movimentacoes"],
): Promise<number> {
  if (movs.length === 0) return 0;
  const d = getDb();
  const linhas = movs.map((m) => ({
    processoId,
    codigoCnj: m.codigo,
    descricao: m.descricao,
    dataHora: new Date(m.dataHora),
    complemento: (m.complemento ?? null) as any,
    fonte: "datajud",
  }));
  const inseridas = await d
    .insert(schema.movimentacoes)
    .values(linhas)
    .onConflictDoNothing()
    .returning({ id: schema.movimentacoes.id });
  return inseridas.length;
}

export async function upsertComunicacoes(comuns: ComunicacaoDJEN[]): Promise<number> {
  if (comuns.length === 0) return 0;
  const d = getDb();
  const linhas = comuns
    .filter((c) => c.hash)
    .map((c) => ({
      hashDjen: c.hash,
      numeroProcesso: c.numeroProcesso,
      tipo: c.tipoComunicacao,
      meio: "DJEN",
      inteiroTeor: c.texto,
      dataDisponibilizacao: c.dataDisponibilizacao,
      // Forma canônica "numero/UF" (sem a letra de cartório), deduplicada.
      oabDestino:
        Array.from(
          new Set(
            c.advogados
              .map((a) => (a.oab ? canonicalOab(a.oab) : null))
              .filter((x): x is string => Boolean(x)),
          ),
        ).join(", ") || null,
      // Guarda as partes destinatárias: é por elas que se descobre o cliente do escritório.
      destinatarios: (c.destinatarios ?? []) as any,
      processada: false,
    }));
  if (linhas.length === 0) return 0;
  const inseridas = await d
    .insert(schema.comunicacoes)
    .values(linhas)
    .onConflictDoNothing()
    .returning({ id: schema.comunicacoes.id });
  return inseridas.length;
}

export interface FiltroIntimacoes {
  apenasPendentes?: boolean;
  dias?: number;
  numeroCnj?: string;
  limite?: number;
}

export interface IntimacaoBanco {
  id: string;
  dataDisponibilizacao: string | null;
  tipo: string | null;
  meio: string | null;
  numeroProcesso: string | null;
  numeroCnj: string | null;
  clienteNome: string | null;
  tribunal: string | null;
  processoId: string | null;
  processada: boolean | null;
  temPrazo: boolean;
  temAnalise: boolean;
  inteiroTeor: string | null;
}

// Uma intimação "espera tratamento" enquanto ninguém a marcou como cuidada e nenhum prazo vivo
// aponta para ela. Mesma definição que o painel usa na fila de pendências.
const intimacaoTemPrazo = sql<boolean>`exists (
  select 1 from ${schema.prazos}
  where ${schema.prazos.comunicacaoId} = ${schema.comunicacoes.id}
    and ${schema.prazos.status} <> 'cancelado'
)`;

const intimacaoTemAnalise = sql<boolean>`exists (
  select 1 from ${schema.analises}
  where ${schema.analises.comunicacaoId} = ${schema.comunicacoes.id}
    and coalesce(${schema.analises.status}, 'sugerida') <> 'descartada'
)`;

/**
 * Intimações JÁ coletadas, do banco (não vai ao DJEN). Existe porque o id da comunicação é a
 * chave de tudo o que vem depois: é ele que se passa em `comunicacao_id` de `calcular_prazo` e de
 * `salvar_analise`. Sem esta tool, o prazo e a análise nasciam órfãos e o advogado não achava, na
 * intimação, o que o sistema tinha lido dela.
 */
export async function listarIntimacoesBanco(f: FiltroIntimacoes = {}): Promise<IntimacaoBanco[]> {
  const d = getDb();
  const dias = f.dias ?? 15;
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  const conds = [gte(schema.comunicacoes.dataDisponibilizacao, desde)];
  if (f.apenasPendentes ?? true) {
    conds.push(sql`${schema.comunicacoes.processada} is not true and not ${intimacaoTemPrazo}`);
  }
  if (f.numeroCnj) {
    // Compara só os dígitos: o DJEN devolve o número com máscara e a carteira guarda formatado,
    // mas quem chama a tool pode digitar de qualquer jeito.
    const digitos = f.numeroCnj.replace(/\D/g, "");
    conds.push(sql`(
      regexp_replace(coalesce(${schema.comunicacoes.numeroProcesso}, ''), '\\D', '', 'g') = ${digitos}
      or regexp_replace(coalesce(${schema.processos.numeroCnj}, ''), '\\D', '', 'g') = ${digitos}
    )`);
  }

  const rows = await d
    .select({
      id: schema.comunicacoes.id,
      dataDisponibilizacao: schema.comunicacoes.dataDisponibilizacao,
      tipo: schema.comunicacoes.tipo,
      meio: schema.comunicacoes.meio,
      numeroProcesso: schema.comunicacoes.numeroProcesso,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
      tribunal: schema.processos.tribunal,
      processoId: schema.comunicacoes.processoId,
      processada: schema.comunicacoes.processada,
      temPrazo: intimacaoTemPrazo,
      temAnalise: intimacaoTemAnalise,
      inteiroTeor: schema.comunicacoes.inteiroTeor,
    })
    .from(schema.comunicacoes)
    .leftJoin(schema.processos, eq(schema.comunicacoes.processoId, schema.processos.id))
    .where(and(...conds))
    .orderBy(desc(schema.comunicacoes.dataDisponibilizacao))
    .limit(f.limite ?? 30);
  return rows as IntimacaoBanco[];
}

export type ResultadoAnalise =
  | { ok: true; id: string; versao: number; processoId: string | null; jaConfirmada: boolean }
  | { ok: false; motivo: "sem_alvo" | "comunicacao_inexistente" | "documento_inexistente" | "processo_fora_carteira" };

/**
 * Grava uma análise (de intimação ou documento) na tabela `analises`. Nasce origem='maquina',
 * status='sugerida'; o advogado revisa no painel e tem a palavra final.
 *
 * O alvo é obrigatório: comunicação (intimação), documento ou, na falta dos dois, o processo pelo
 * CNJ. Análise sem alvo é análise que ninguém encontra. Quando o alvo é a comunicação, o processo
 * é DERIVADO dela: assim a análise de uma intimação de processo que ainda não está na carteira
 * também é gravada, em vez de recusada.
 *
 * NUNCA faz UPDATE: análise nova sobre o mesmo alvo é linha nova com `versao` + 1, e a que o
 * advogado confirmou continua intacta.
 */
export async function salvarAnalise(a: {
  numeroCnj?: string;
  comunicacaoId?: string;
  documentoId?: string;
  tipo: string;
  conteudo: unknown;
  modelo?: string;
}): Promise<ResultadoAnalise> {
  const d = getDb();
  if (!a.comunicacaoId && !a.documentoId && !a.numeroCnj) return { ok: false, motivo: "sem_alvo" };

  let processoId: string | null = null;

  if (a.comunicacaoId) {
    const [com] = await d
      .select({ processoId: schema.comunicacoes.processoId })
      .from(schema.comunicacoes)
      .where(eq(schema.comunicacoes.id, a.comunicacaoId))
      .limit(1);
    if (!com) return { ok: false, motivo: "comunicacao_inexistente" };
    processoId = com.processoId;
  }

  if (a.documentoId) {
    const [doc] = await d
      .select({ processoId: schema.documentos.processoId })
      .from(schema.documentos)
      .where(eq(schema.documentos.id, a.documentoId))
      .limit(1);
    if (!doc) return { ok: false, motivo: "documento_inexistente" };
    processoId = processoId ?? doc.processoId;
  }

  if (!processoId && a.numeroCnj) {
    processoId = await processoExistente(a.numeroCnj);
    // Só é erro quando o CNJ era o ÚNICO alvo: sem ele e sem comunicação/documento, a análise
    // não teria onde aparecer.
    if (!processoId && !a.comunicacaoId && !a.documentoId)
      return { ok: false, motivo: "processo_fora_carteira" };
  }

  const anteriores = await d
    .select({ versao: schema.analises.versao, status: schema.analises.status })
    .from(schema.analises)
    .where(
      a.comunicacaoId
        ? eq(schema.analises.comunicacaoId, a.comunicacaoId)
        : a.documentoId
          ? eq(schema.analises.documentoId, a.documentoId)
          : and(eq(schema.analises.processoId, processoId as string), eq(schema.analises.tipo, a.tipo)),
    );
  const versao = anteriores.reduce((maior, x) => Math.max(maior, x.versao ?? 1), 0) + 1;
  const jaConfirmada = anteriores.some((x) => x.status === "confirmada");

  const [row] = await d
    .insert(schema.analises)
    .values({
      processoId,
      comunicacaoId: a.comunicacaoId ?? null,
      documentoId: a.documentoId ?? null,
      tipo: a.tipo,
      conteudo: a.conteudo as any,
      versao,
      status: "sugerida",
      origem: "maquina",
      modelo: a.modelo ?? null,
    })
    .returning({ id: schema.analises.id });
  return { ok: true, id: row.id, versao, processoId, jaConfirmada };
}

// ===== Peças e modelos do escritório =====

/**
 * Modelos-peça do escritório de um dado tipo (e opcionalmente tags). São a base de
 * ESTRUTURA e ESTILO que o redator usa. NUNCA são fonte de citação (a citação vem
 * verificada pelo pesquisador). Retorna vazio se não houver modelo cadastrado.
 */
export async function buscarModelos(filtro: {
  tipo?: string;
  tags?: string[];
}): Promise<
  Array<{ id: string; tipo: string; titulo: string; textoExtraido: string | null; tags: string[] | null }>
> {
  const d = getDb();
  const conds = [eq(schema.modelosPeca.ativo, true)];
  if (filtro.tipo) conds.push(eq(schema.modelosPeca.tipo, filtro.tipo));
  return await d
    .select({
      id: schema.modelosPeca.id,
      tipo: schema.modelosPeca.tipo,
      titulo: schema.modelosPeca.titulo,
      textoExtraido: schema.modelosPeca.textoExtraido,
      tags: schema.modelosPeca.tags,
    })
    .from(schema.modelosPeca)
    .where(and(...conds))
    .orderBy(desc(schema.modelosPeca.criadoEm));
}

/** Grava um modelo-peça do escritório (vindo do upload nas Configurações). */
export async function salvarModelo(m: {
  tipo: string;
  titulo: string;
  textoExtraido?: string;
  arquivoNome?: string;
  tags?: string[];
}): Promise<{ id: string }> {
  const d = getDb();
  const [row] = await d
    .insert(schema.modelosPeca)
    .values({
      tipo: m.tipo,
      titulo: m.titulo,
      textoExtraido: m.textoExtraido ?? null,
      arquivoNome: m.arquivoNome ?? null,
      tags: m.tags ?? [],
    })
    .returning({ id: schema.modelosPeca.id });
  return { id: row.id };
}

/**
 * Grava o rascunho de uma peça (origem 'maquina', status 'gerado'). Se `pecaId` vier,
 * atualiza a linha pendente que o painel criou; senão insere nova. REGRA DE OURO: nunca
 * sobrescreve peça que o advogado já assumiu como 'humana' (retorna null nesse caso).
 */
export async function salvarPeca(p: {
  pecaId?: string;
  processoId?: string | null;
  prazoId?: string | null;
  clienteId?: string | null;
  tipo: string;
  titulo?: string;
  conteudo: string;
  modeloBaseId?: string | null;
}): Promise<{ id: string } | null> {
  const d = getDb();
  if (p.pecaId) {
    const [existente] = await d
      .select({ origem: schema.pecas.origem })
      .from(schema.pecas)
      .where(eq(schema.pecas.id, p.pecaId))
      .limit(1);
    if (existente?.origem === "humana") return null;
    const [row] = await d
      .update(schema.pecas)
      .set({
        conteudo: p.conteudo,
        titulo: p.titulo ?? null,
        modeloBaseId: p.modeloBaseId ?? null,
        status: "gerado",
        atualizadoEm: new Date(),
      })
      .where(eq(schema.pecas.id, p.pecaId))
      .returning({ id: schema.pecas.id });
    return row ? { id: row.id } : null;
  }
  const [row] = await d
    .insert(schema.pecas)
    .values({
      processoId: p.processoId ?? null,
      prazoId: p.prazoId ?? null,
      clienteId: p.clienteId ?? null,
      modeloBaseId: p.modeloBaseId ?? null,
      tipo: p.tipo,
      titulo: p.titulo ?? null,
      conteudo: p.conteudo,
      status: "gerado",
      origem: "maquina",
    })
    .returning({ id: schema.pecas.id });
  return { id: row.id };
}

/**
 * Retorna o id do processo na carteira pelo número CNJ (compara sempre com máscara), ou null
 * se ainda não estiver cadastrado.
 */
export async function processoExistente(numeroCnj: string): Promise<string | null> {
  const d = getDb();
  const [row] = await d
    .select({ id: schema.processos.id })
    .from(schema.processos)
    .where(eq(schema.processos.numeroCnj, formatarCNJ(numeroCnj)))
    .limit(1);
  return row?.id ?? null;
}

/** Vincula uma comunicação (pelo hash do DJEN) a um processo da carteira. */
export async function vincularComunicacao(hashDjen: string, processoId: string): Promise<void> {
  const d = getDb();
  await d
    .update(schema.comunicacoes)
    .set({ processoId })
    .where(eq(schema.comunicacoes.hashDjen, hashDjen));
}

export interface NovoPrazo {
  processoId: string | null;
  comunicacaoId?: string | null;
  ato: string;
  regraAplicada?: string;
  calculo: CalcularPrazoResult;
  justificativaIA?: string;
}

export async function inserirPrazoSugerido(p: NovoPrazo): Promise<{ id: string }> {
  const d = getDb();
  const [row] = await d
    .insert(schema.prazos)
    .values({
      processoId: p.processoId,
      comunicacaoId: p.comunicacaoId ?? null,
      ato: p.ato,
      regraAplicada: p.regraAplicada ?? null,
      dias: p.calculo.dias,
      contagem: p.calculo.contagem,
      dataPublicacao: p.calculo.dataPublicacao,
      dataInicio: p.calculo.dataInicioContagem,
      dataFatalSugerida: p.calculo.dataFatal,
      dataFatal: p.calculo.dataFatal,
      status: "sugerido",
      origem: "maquina",
      justificativaIa: p.justificativaIA ?? p.calculo.memoria.join(" "),
      // Pendências [CONFERIR] do cálculo (divergência de rito, termo inicial incerto, dobro
      // recusado). O painel mostra ao advogado antes da confirmação.
      divergencia: p.calculo.alertas.length > 0 ? { conferir: p.calculo.alertas } : null,
    })
    .returning({ id: schema.prazos.id });
  return { id: row.id };
}

/**
 * Marca a intimação como já tratada. Chamada quando o prazo dela é gravado: a comunicação
 * deixa a fila de pendências que a Início e a aba Prazos mostram.
 */
export async function marcarComunicacaoProcessada(comunicacaoId: string): Promise<void> {
  const d = getDb();
  await d
    .update(schema.comunicacoes)
    .set({ processada: true })
    .where(eq(schema.comunicacoes.id, comunicacaoId));
}

export async function confirmarPrazo(prazoId: string, editor: string): Promise<void> {
  const d = getDb();
  await d
    .update(schema.prazos)
    .set({ status: "confirmado", origem: "humana", editadoPor: editor, editadoEm: new Date() })
    .where(eq(schema.prazos.id, prazoId));
}

export async function editarPrazo(
  prazoId: string,
  patch: { dataFatal?: string; ato?: string; status?: string },
  editor: string,
): Promise<void> {
  const d = getDb();
  await d
    .update(schema.prazos)
    .set({
      origem: "humana",
      status: patch.status ?? "editado",
      editadoPor: editor,
      editadoEm: new Date(),
      ...(patch.dataFatal ? { dataFatal: patch.dataFatal } : {}),
      ...(patch.ato ? { ato: patch.ato } : {}),
    })
    .where(eq(schema.prazos.id, prazoId));
}

export interface FiltroPrazos {
  ate?: string;
  desde?: string;
  status?: string;
}

export async function listarPrazos(filtro: FiltroPrazos = {}) {
  const d = getDb();
  const conds = [ne(schema.prazos.status, "cancelado")];
  if (filtro.desde) conds.push(gte(schema.prazos.dataFatal, filtro.desde));
  if (filtro.ate) conds.push(lte(schema.prazos.dataFatal, filtro.ate));
  if (filtro.status) conds.push(eq(schema.prazos.status, filtro.status));
  const rows = await d
    .select({
      id: schema.prazos.id,
      ato: schema.prazos.ato,
      dataFatal: schema.prazos.dataFatal,
      dataFatalSugerida: schema.prazos.dataFatalSugerida,
      status: schema.prazos.status,
      origem: schema.prazos.origem,
      processoId: schema.prazos.processoId,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
    })
    .from(schema.prazos)
    .leftJoin(schema.processos, eq(schema.prazos.processoId, schema.processos.id))
    .where(and(...conds))
    .orderBy(schema.prazos.dataFatal);
  return rows;
}

export async function pesquisarCarteira(termo: string) {
  const d = getDb();
  const base = d
    .select({
      id: schema.processos.id,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
      classe: schema.processos.classe,
      tribunal: schema.processos.tribunal,
      status: schema.processos.status,
    })
    .from(schema.processos);
  const rows = termo
    ? await base
        .where(or(ilike(schema.processos.clienteNome, `%${termo}%`), ilike(schema.processos.numeroCnj, `%${termo}%`)))
        .limit(20)
    : await base.limit(200);
  return rows;
}

export async function registrarFeriado(
  tribunal: string,
  data: string,
  descricao?: string,
  tipo = "feriado",
): Promise<void> {
  const d = getDb();
  await d
    .insert(schema.feriadosForenses)
    .values({ tribunal, data, descricao, tipo })
    .onConflictDoUpdate({
      target: [schema.feriadosForenses.tribunal, schema.feriadosForenses.data],
      set: { descricao, tipo },
    });
}

export async function carregarFeriadosForenses(tribunal: string): Promise<string[]> {
  if (!bancoConfigurado()) return [];
  try {
    const d = getDb();
    const rows = await d
      .select({ data: schema.feriadosForenses.data })
      .from(schema.feriadosForenses)
      .where(eq(schema.feriadosForenses.tribunal, tribunal));
    return rows.map((r) => r.data as string);
  } catch {
    return [];
  }
}

export interface DadosSincronizacao {
  escopo?: string | null;
  status: "ok" | "erro" | "parcial";
  itens?: number;
  novos?: number;
  mensagem?: string | null;
}

export interface RegistroSincronizacao {
  fonte: string;
  escopo: string | null;
  status: string;
  itens: number | null;
  novos: number | null;
  mensagem: string | null;
  iniciadoEm: Date | null;
  concluidoEm: Date | null;
}

// Grava uma linha de coleta. No-op silencioso se o banco não está configurado
// (o MCP segue rodando; só não há histórico persistido).
export async function registrarSincronizacao(
  fonte: string,
  dados: DadosSincronizacao,
): Promise<void> {
  if (!bancoConfigurado()) return;
  try {
    const d = getDb();
    await d.insert(schema.sincronizacoes).values({
      fonte,
      escopo: dados.escopo ?? null,
      status: dados.status,
      itens: dados.itens ?? 0,
      novos: dados.novos ?? 0,
      mensagem: dados.mensagem ?? null,
      concluidoEm: new Date(),
    });
  } catch {
    // Nunca deixar a telemetria derrubar a operação principal.
  }
}

/**
 * Última sincronização de uma fonte.
 *
 * Retorna null só quando REALMENTE não há registro. Falha de conexão sobe como exceção: antes
 * ela virava null e o painel dizia "nenhuma coleta registrada ainda", que é a mentira mais
 * perigosa que este sistema pode contar ao advogado. Não coletar nada e não conseguir perguntar
 * são coisas diferentes, e ele precisa saber qual das duas está acontecendo.
 */
export async function ultimaSincronizacao(
  fonte: string,
): Promise<RegistroSincronizacao | null> {
  if (!bancoConfigurado()) {
    throw new Error(
      "Banco não configurado: não é possível saber quando foi a última coleta. Defina " +
        "DATABASE_URL no ambiente ou em mcp-server/.env.",
    );
  }
  {
    const d = getDb();
    const [row] = await d
      .select()
      .from(schema.sincronizacoes)
      .where(eq(schema.sincronizacoes.fonte, fonte))
      .orderBy(desc(schema.sincronizacoes.iniciadoEm))
      .limit(1);
    if (!row) return null;
    return {
      fonte: row.fonte,
      escopo: row.escopo,
      status: row.status,
      itens: row.itens,
      novos: row.novos,
      mensagem: row.mensagem,
      iniciadoEm: row.iniciadoEm,
      concluidoEm: row.concluidoEm,
    };
  }
}

// Utilitário de auto-teste de conexão (usado no README/setup).
export async function ping(): Promise<boolean> {
  const d = getDb();
  await d.execute(sql`select 1`);
  return true;
}

// ---------------------------------------------------------------------------
// Documentos do processo (upload pelo painel e pelo terminal)
// ---------------------------------------------------------------------------

export interface NovoDocumento {
  processoId: string;
  titulo: string;
  tipo: string;
  categoria: string;
  storagePath: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
  hashSha256: string;
  paginas?: number | null;
  texto?: string | null;
  extracaoStatus: string;
  fonte: string;
  enviadoPor: string;
  descricao?: string | null;
  dataDocumento?: string | null;
}

export async function inserirDocumento(doc: NovoDocumento): Promise<{ id: string }> {
  const d = getDb();
  const [row] = await d
    .insert(schema.documentos)
    .values({
      processoId: doc.processoId,
      titulo: doc.titulo,
      tipo: doc.tipo,
      categoria: doc.categoria,
      storagePath: doc.storagePath,
      arquivoNome: doc.arquivoNome,
      mimeType: doc.mimeType,
      tamanhoBytes: doc.tamanhoBytes,
      hashSha256: doc.hashSha256,
      paginas: doc.paginas ?? null,
      texto: doc.texto ?? null,
      textoExtraido: doc.extracaoStatus === "ok",
      extracaoStatus: doc.extracaoStatus,
      extraidoEm: doc.extracaoStatus === "pendente" ? null : new Date(),
      fonte: doc.fonte,
      enviadoPor: doc.enviadoPor,
      descricao: doc.descricao ?? null,
      dataDocumento: doc.dataDocumento ?? null,
    })
    .returning({ id: schema.documentos.id });
  return { id: row.id };
}

/** Dedup por processo: o mesmo arquivo não entra duas vezes no mesmo processo. */
export async function documentoPorHash(
  processoId: string,
  hashSha256: string,
): Promise<{ id: string; titulo: string | null; categoria: string | null; createdAt: Date | null } | null> {
  const d = getDb();
  const [row] = await d
    .select({
      id: schema.documentos.id,
      titulo: schema.documentos.titulo,
      categoria: schema.documentos.categoria,
      createdAt: schema.documentos.createdAt,
    })
    .from(schema.documentos)
    .where(
      and(
        eq(schema.documentos.processoId, processoId),
        eq(schema.documentos.hashSha256, hashSha256),
        isNull(schema.documentos.excluidoEm),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Lista os documentos de um processo. NÃO traz a coluna `texto` (pesada). */
export async function listarDocumentos(processoId: string, categoria?: string) {
  const d = getDb();
  const filtros = [eq(schema.documentos.processoId, processoId), isNull(schema.documentos.excluidoEm)];
  if (categoria) filtros.push(eq(schema.documentos.categoria, categoria));
  return d
    .select({
      id: schema.documentos.id,
      titulo: schema.documentos.titulo,
      categoria: schema.documentos.categoria,
      tipo: schema.documentos.tipo,
      paginas: schema.documentos.paginas,
      tamanhoBytes: schema.documentos.tamanhoBytes,
      extracaoStatus: schema.documentos.extracaoStatus,
      fonte: schema.documentos.fonte,
      dataDocumento: schema.documentos.dataDocumento,
      createdAt: schema.documentos.createdAt,
    })
    .from(schema.documentos)
    .where(and(...filtros))
    .orderBy(desc(schema.documentos.createdAt));
}

/** Texto extraído de um documento, paginado (ele pode ser grande). */
export async function textoDocumento(documentoId: string) {
  const d = getDb();
  const [row] = await d
    .select({
      id: schema.documentos.id,
      titulo: schema.documentos.titulo,
      categoria: schema.documentos.categoria,
      paginas: schema.documentos.paginas,
      texto: schema.documentos.texto,
      extracaoStatus: schema.documentos.extracaoStatus,
      storagePath: schema.documentos.storagePath,
    })
    .from(schema.documentos)
    .where(and(eq(schema.documentos.id, documentoId), isNull(schema.documentos.excluidoEm)))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Clientes e partes do processo
//
// O DataJud NÃO devolve as partes (a API pública não expõe nome de parte), então o nome do
// cliente não vem da coleta: ou o advogado informa, ou é lido do TEOR da intimação, que traz a
// qualificação. Por isso a extração é feita pelo Claude lendo o texto, não por regex.
// ---------------------------------------------------------------------------

/**
 * Processos sem cliente definido, com o teor das intimações vinculadas, para o Claude ler e
 * identificar as partes. Traz só um pedaço do texto: o suficiente para achar a qualificação.
 */
export async function processosSemCliente(limite = 30): Promise<
  Array<{ id: string; numeroCnj: string; classe: string | null; teores: string[] }>
> {
  const d = getDb();
  const procs = await d
    .select({
      id: schema.processos.id,
      numeroCnj: schema.processos.numeroCnj,
      classe: schema.processos.classe,
    })
    .from(schema.processos)
    .where(and(isNull(schema.processos.clienteNome), ne(schema.processos.status, "arquivado")))
    .limit(limite);

  const saida = [];
  for (const p of procs) {
    const coms = await d
      .select({ inteiroTeor: schema.comunicacoes.inteiroTeor })
      .from(schema.comunicacoes)
      .where(eq(schema.comunicacoes.processoId, p.id))
      .orderBy(desc(schema.comunicacoes.dataDisponibilizacao))
      // Três intimações: nem toda peça nomeia as partes (na amostra do escritório, menos da
      // metade nomeia), então olhar mais de uma aumenta a chance de achar a qualificação.
      .limit(3);
    saida.push({
      ...p,
      teores: coms
        .map((c) => (c.inteiroTeor ?? "").replace(/\s+/g, " ").slice(0, 1800))
        .filter(Boolean),
    });
  }
  return saida;
}

/**
 * Cadastra (ou reaproveita) o cliente, vincula ao processo com o papel e atualiza o cache
 * `processos.clienteNome`. Reaproveita pelo documento (CPF/CNPJ) quando houver; senão, pelo nome.
 */
export async function definirClienteProcesso(p: {
  numeroCnj: string;
  nome: string;
  papel: string;
  documento?: string | null;
}): Promise<{ processoId: string; clienteId: string } | null> {
  const d = getDb();
  const processoId = await processoExistente(p.numeroCnj);
  if (!processoId) return null;

  const nome = p.nome.trim();
  const documento = p.documento?.replace(/\D/g, "") || null;

  const [existente] = await d
    .select({ id: schema.clientes.id })
    .from(schema.clientes)
    .where(documento ? eq(schema.clientes.documento, documento) : eq(schema.clientes.nome, nome))
    .limit(1);

  let clienteId = existente?.id;
  if (!clienteId) {
    const [novo] = await d
      .insert(schema.clientes)
      .values({
        nome,
        documento,
        tipoDocumento: documento ? (documento.length > 11 ? "CNPJ" : "CPF") : null,
      })
      .returning({ id: schema.clientes.id });
    clienteId = novo.id;
  }

  await d
    .insert(schema.processoPartes)
    .values({ processoId, clienteId, papel: p.papel, principal: true })
    .onConflictDoNothing();

  await d
    .update(schema.processos)
    .set({ clienteNome: nome })
    .where(eq(schema.processos.id, processoId));

  return { processoId, clienteId };
}
