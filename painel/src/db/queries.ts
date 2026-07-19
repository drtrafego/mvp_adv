import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "./index";

export interface PrazoRow {
  id: string;
  ato: string;
  dataFatal: string;
  dataFatalSugerida: string;
  status: string;
  origem: string;
  contagem: string | null;
  dias: number | null;
  justificativaIa: string | null;
  numeroCnj: string | null;
  clienteNome: string | null;
  tribunal: string | null;
}

/** Lista prazos não cancelados, ordenados pela data fatal. */
export async function listarPrazos(): Promise<PrazoRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.prazos.id,
      ato: schema.prazos.ato,
      dataFatal: schema.prazos.dataFatal,
      dataFatalSugerida: schema.prazos.dataFatalSugerida,
      status: schema.prazos.status,
      origem: schema.prazos.origem,
      contagem: schema.prazos.contagem,
      dias: schema.prazos.dias,
      justificativaIa: schema.prazos.justificativaIa,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
      tribunal: schema.processos.tribunal,
    })
    .from(schema.prazos)
    .leftJoin(schema.processos, eq(schema.prazos.processoId, schema.processos.id))
    .where(ne(schema.prazos.status, "cancelado"))
    .orderBy(schema.prazos.dataFatal);
  return rows as PrazoRow[];
}

export interface ProcessoRow {
  id: string;
  numeroCnj: string;
  clienteNome: string | null;
  classe: string | null;
  tribunal: string;
  fase: string | null;
  status: string | null;
  ultimaSincronizacao: Date | null;
  arquivadoEm: Date | null;
}

/** Lista processos não excluídos (soft-delete), do mais recente ao mais antigo. */
export async function listarProcessos(): Promise<ProcessoRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.processos.id,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
      classe: schema.processos.classe,
      tribunal: schema.processos.tribunal,
      fase: schema.processos.fase,
      status: schema.processos.status,
      ultimaSincronizacao: schema.processos.ultimaSincronizacao,
      arquivadoEm: schema.processos.arquivadoEm,
    })
    .from(schema.processos)
    .where(isNull(schema.processos.excluidoEm))
    .orderBy(desc(schema.processos.ultimaSincronizacao))
    .limit(100);
  return rows as ProcessoRow[];
}

export interface DetalheProcesso {
  processo: typeof schema.processos.$inferSelect;
  prazos: (typeof schema.prazos.$inferSelect)[];
  movimentacoes: (typeof schema.movimentacoes.$inferSelect)[];
  documentos: (typeof schema.documentos.$inferSelect)[];
  anotacoes: (typeof schema.anotacoes.$inferSelect)[];
  partes: {
    parte: typeof schema.processoPartes.$inferSelect;
    cliente: typeof schema.clientes.$inferSelect | null;
  }[];
  fases: (typeof schema.fasesProcesso.$inferSelect)[];
}

/** Carrega o processo e todas as suas relações para o modal/página de detalhe. */
export async function detalheProcesso(id: string): Promise<DetalheProcesso | null> {
  if (!db) return null;

  const [processo] = await db
    .select()
    .from(schema.processos)
    .where(eq(schema.processos.id, id))
    .limit(1);
  if (!processo) return null;

  const prazos = await db
    .select()
    .from(schema.prazos)
    .where(eq(schema.prazos.processoId, id))
    .orderBy(schema.prazos.dataFatal);

  const movimentacoes = await db
    .select()
    .from(schema.movimentacoes)
    .where(eq(schema.movimentacoes.processoId, id))
    .orderBy(desc(schema.movimentacoes.dataHora));

  const documentos = await db
    .select()
    .from(schema.documentos)
    .where(eq(schema.documentos.processoId, id))
    .orderBy(desc(schema.documentos.createdAt));

  const anotacoes = await db
    .select()
    .from(schema.anotacoes)
    .where(eq(schema.anotacoes.processoId, id))
    .orderBy(desc(schema.anotacoes.criadoEm));

  const partesRows = await db
    .select({ parte: schema.processoPartes, cliente: schema.clientes })
    .from(schema.processoPartes)
    .leftJoin(schema.clientes, eq(schema.processoPartes.clienteId, schema.clientes.id))
    .where(eq(schema.processoPartes.processoId, id))
    .orderBy(desc(schema.processoPartes.principal));

  const fases = await db
    .select()
    .from(schema.fasesProcesso)
    .where(eq(schema.fasesProcesso.processoId, id))
    .orderBy(asc(schema.fasesProcesso.criadoEm));

  return {
    processo,
    prazos,
    movimentacoes,
    documentos,
    anotacoes,
    partes: partesRows,
    fases,
  };
}

export interface Resumo {
  totalProcessos: number;
  prazosAbertos: number;
  sugeridos: number;
  venceEm7Dias: number;
}

export async function resumo(): Promise<Resumo> {
  if (!db) return { totalProcessos: 0, prazosAbertos: 0, sugeridos: 0, venceEm7Dias: 0 };
  const hoje = new Date().toISOString().slice(0, 10);
  const daqui7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [tp] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.processos);
  const [pa] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.prazos)
    .where(ne(schema.prazos.status, "cancelado"));
  const [sg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.prazos)
    .where(eq(schema.prazos.status, "sugerido"));
  const [v7] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.prazos)
    .where(
      and(
        ne(schema.prazos.status, "cancelado"),
        gte(schema.prazos.dataFatal, hoje),
        lte(schema.prazos.dataFatal, daqui7),
      ),
    );
  return {
    totalProcessos: tp?.n ?? 0,
    prazosAbertos: pa?.n ?? 0,
    sugeridos: sg?.n ?? 0,
    venceEm7Dias: v7?.n ?? 0,
  };
}
