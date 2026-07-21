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

export interface IntimacaoRow {
  id: string;
  tipo: string | null;
  meio: string | null;
  dataDisponibilizacao: string | null;
  dataPublicacao: string | null;
  oabDestino: string | null;
  inteiroTeor: string | null;
  processada: boolean | null;
  numeroProcesso: string | null;
  numeroCnj: string | null;
}

/** Últimas intimações/comunicações (DJEN), da mais recente para a mais antiga. */
export async function listarIntimacoes(): Promise<IntimacaoRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.comunicacoes.id,
      tipo: schema.comunicacoes.tipo,
      meio: schema.comunicacoes.meio,
      dataDisponibilizacao: schema.comunicacoes.dataDisponibilizacao,
      dataPublicacao: schema.comunicacoes.dataPublicacao,
      oabDestino: schema.comunicacoes.oabDestino,
      inteiroTeor: schema.comunicacoes.inteiroTeor,
      processada: schema.comunicacoes.processada,
      numeroProcesso: schema.comunicacoes.numeroProcesso,
      numeroCnj: schema.processos.numeroCnj,
    })
    .from(schema.comunicacoes)
    .leftJoin(schema.processos, eq(schema.comunicacoes.processoId, schema.processos.id))
    .orderBy(desc(schema.comunicacoes.dataDisponibilizacao))
    .limit(100);
  return rows as IntimacaoRow[];
}

export interface AnaliseConteudo {
  tipo_ato?: string;
  resultado?: string;
  resumo?: string;
  acao_necessaria?: string;
  prazo?: string | null;
  pontos?: string[];
  atencao?: string;
}

export interface AnaliseRow {
  id: string;
  tipo: string;
  conteudo: AnaliseConteudo;
  origem: string | null;
  modelo: string | null;
  createdAt: Date | null;
  processoId: string | null;
  numeroCnj: string | null;
  clienteNome: string | null;
}

/** Análises de documentos/intimações produzidas pela máquina, para o advogado revisar. */
export async function listarAnalises(): Promise<AnaliseRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.analises.id,
      tipo: schema.analises.tipo,
      conteudo: schema.analises.conteudo,
      origem: schema.analises.origem,
      modelo: schema.analises.modelo,
      createdAt: schema.analises.createdAt,
      processoId: schema.analises.processoId,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
    })
    .from(schema.analises)
    .leftJoin(schema.processos, eq(schema.analises.processoId, schema.processos.id))
    .orderBy(desc(schema.analises.createdAt))
    .limit(100);
  return rows as AnaliseRow[];
}

export interface ClienteRow {
  nome: string;
  clienteId: string | null;
  totalProcessos: number;
}

/**
 * Clientes da carteira: une os cadastrados na tabela `clientes` (ex.: importados de planilha) com
 * os nomes que aparecem só nos processos, sem duplicar, conta os processos de cada um e traz o
 * `clienteId` quando o cliente tem cadastro (necessário para abrir o detalhe em /c/[id]).
 */
export async function listarClientes(): Promise<ClienteRow[]> {
  if (!db) return [];
  const res = await db.execute(sql`
    SELECT todos.nome AS nome, todos.cliente_id AS "clienteId", count(p.id)::int AS "totalProcessos"
    FROM (
      SELECT nome, id AS cliente_id FROM clientes WHERE nome IS NOT NULL AND nome <> ''
      UNION ALL
      SELECT DISTINCT cliente_nome AS nome, NULL::uuid AS cliente_id FROM processos
        WHERE cliente_nome IS NOT NULL AND cliente_nome <> '' AND excluido_em IS NULL
          AND cliente_nome NOT IN (SELECT nome FROM clientes WHERE nome IS NOT NULL AND nome <> '')
    ) todos
    LEFT JOIN processos p ON p.cliente_nome = todos.nome AND p.excluido_em IS NULL
    GROUP BY todos.nome, todos.cliente_id
    ORDER BY todos.nome
  `);
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows) ?? [];
  return rows as ClienteRow[];
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

// ============================================================================
// Modelos-peça (banco de peças) e peças geradas
// ============================================================================

export interface ModeloRow {
  id: string;
  tipo: string;
  titulo: string;
  tags: string[] | null;
  criadoEm: Date | null;
}

/** Modelos-peça ativos do escritório, do mais recente ao mais antigo. */
export async function listarModelos(): Promise<ModeloRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.modelosPeca.id,
      tipo: schema.modelosPeca.tipo,
      titulo: schema.modelosPeca.titulo,
      tags: schema.modelosPeca.tags,
      criadoEm: schema.modelosPeca.criadoEm,
    })
    .from(schema.modelosPeca)
    .where(eq(schema.modelosPeca.ativo, true))
    .orderBy(desc(schema.modelosPeca.criadoEm));
  return rows as ModeloRow[];
}

export interface PecaRow {
  id: string;
  tipo: string;
  titulo: string | null;
  status: string | null;
  origem: string | null;
  criadoEm: Date | null;
  atualizadoEm: Date | null;
  processoId: string | null;
  numeroCnj: string | null;
  clienteNome: string | null;
}

/** Peças não arquivadas, da mais recente para a mais antiga. */
export async function listarPecas(): Promise<PecaRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.pecas.id,
      tipo: schema.pecas.tipo,
      titulo: schema.pecas.titulo,
      status: schema.pecas.status,
      origem: schema.pecas.origem,
      criadoEm: schema.pecas.criadoEm,
      atualizadoEm: schema.pecas.atualizadoEm,
      processoId: schema.pecas.processoId,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
    })
    .from(schema.pecas)
    .leftJoin(schema.processos, eq(schema.pecas.processoId, schema.processos.id))
    .where(ne(schema.pecas.status, "arquivado"))
    .orderBy(desc(schema.pecas.criadoEm))
    .limit(100);
  return rows as PecaRow[];
}

/** Carrega uma peça e o processo/prazo a que se liga, para o modal de detalhe. */
export async function detalhePeca(id: string) {
  if (!db) return null;
  const [peca] = await db.select().from(schema.pecas).where(eq(schema.pecas.id, id)).limit(1);
  if (!peca) return null;
  let processo: typeof schema.processos.$inferSelect | null = null;
  if (peca.processoId) {
    [processo] = await db
      .select()
      .from(schema.processos)
      .where(eq(schema.processos.id, peca.processoId))
      .limit(1);
  }
  return { peca, processo: processo ?? null };
}

// ============================================================================
// Detalhe de cliente e de prazo (modais)
// ============================================================================

export interface DetalheCliente {
  cliente: typeof schema.clientes.$inferSelect;
  processos: ProcessoRow[];
  anotacoes: (typeof schema.anotacoes.$inferSelect)[];
  pecas: (typeof schema.pecas.$inferSelect)[];
}

/** Cliente + processos vinculados (por nome) + anotações + peças, para o modal. */
export async function detalheCliente(id: string): Promise<DetalheCliente | null> {
  if (!db) return null;
  const [cliente] = await db
    .select()
    .from(schema.clientes)
    .where(eq(schema.clientes.id, id))
    .limit(1);
  if (!cliente) return null;

  const processos = (await db
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
    .where(and(isNull(schema.processos.excluidoEm), eq(schema.processos.clienteNome, cliente.nome)))
    .orderBy(desc(schema.processos.ultimaSincronizacao))) as ProcessoRow[];

  const anotacoes = await db
    .select()
    .from(schema.anotacoes)
    .where(eq(schema.anotacoes.clienteId, id))
    .orderBy(desc(schema.anotacoes.criadoEm));

  const pecas = await db
    .select()
    .from(schema.pecas)
    .where(eq(schema.pecas.clienteId, id))
    .orderBy(desc(schema.pecas.criadoEm));

  return { cliente, processos, anotacoes, pecas };
}

export interface DetalhePrazo {
  prazo: typeof schema.prazos.$inferSelect;
  processo: typeof schema.processos.$inferSelect | null;
  anotacoes: (typeof schema.anotacoes.$inferSelect)[];
  pecas: (typeof schema.pecas.$inferSelect)[];
}

/** Prazo + processo vinculado + anotações + peças, para o modal. */
export async function detalhePrazo(id: string): Promise<DetalhePrazo | null> {
  if (!db) return null;
  const [prazo] = await db.select().from(schema.prazos).where(eq(schema.prazos.id, id)).limit(1);
  if (!prazo) return null;

  let processo: typeof schema.processos.$inferSelect | null = null;
  if (prazo.processoId) {
    [processo] = await db
      .select()
      .from(schema.processos)
      .where(eq(schema.processos.id, prazo.processoId))
      .limit(1);
  }

  const anotacoes = await db
    .select()
    .from(schema.anotacoes)
    .where(eq(schema.anotacoes.prazoId, id))
    .orderBy(desc(schema.anotacoes.criadoEm));

  const pecas = await db
    .select()
    .from(schema.pecas)
    .where(eq(schema.pecas.prazoId, id))
    .orderBy(desc(schema.pecas.criadoEm));

  return { prazo, processo: processo ?? null, anotacoes, pecas };
}
