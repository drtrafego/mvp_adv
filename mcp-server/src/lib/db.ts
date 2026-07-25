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
import { and, desc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm";
import * as schema from "./schema.js";
import type { ProcessoDataJud } from "./datajud.js";
import type { ComunicacaoDJEN } from "./comunica.js";
import type { CalcularPrazoResult } from "./prazos.js";
import { canonicalOab } from "./oab.js";
import { formatarCNJ } from "./cnj.js";

let db: NeonHttpDatabase<typeof schema> | null = null;

export function bancoConfigurado(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!bancoConfigurado()) {
    throw new Error(
      "Banco não configurado. Defina DATABASE_URL (string de conexão do Neon) no ambiente " +
        "para persistir processos, movimentações e prazos.",
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

/**
 * Grava uma análise (de intimação ou documento) na tabela `analises`, ligada a um processo
 * da carteira pelo número CNJ. Nasce origem='maquina' (sugerida); o advogado revisa no painel.
 * Retorna null se o processo ainda não estiver na carteira.
 */
export async function salvarAnalise(a: {
  numeroCnj: string;
  tipo: string;
  conteudo: unknown;
  modelo?: string;
}): Promise<{ id: string } | null> {
  const d = getDb();
  const processoId = await processoExistente(a.numeroCnj);
  if (!processoId) return null;
  const [row] = await d
    .insert(schema.analises)
    .values({
      processoId,
      tipo: a.tipo,
      conteudo: a.conteudo as any,
      origem: "maquina",
      modelo: a.modelo ?? null,
    })
    .returning({ id: schema.analises.id });
  return { id: row.id };
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

// Última sincronização de uma fonte. Retorna null se banco ausente ou sem registros.
export async function ultimaSincronizacao(
  fonte: string,
): Promise<RegistroSincronizacao | null> {
  if (!bancoConfigurado()) return null;
  try {
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
  } catch {
    return null;
  }
}

// Utilitário de auto-teste de conexão (usado no README/setup).
export async function ping(): Promise<boolean> {
  const d = getDb();
  await d.execute(sql`select 1`);
  return true;
}
