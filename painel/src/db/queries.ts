import "server-only";
import { and, asc, desc, eq, gte, ilike, isNull, lte, ne, or, sql } from "drizzle-orm";
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
  documentos: Omit<typeof schema.documentos.$inferSelect, "texto" | "excluidoEm">[];
  anotacoes: (typeof schema.anotacoes.$inferSelect)[];
  comunicacoes: (typeof schema.comunicacoes.$inferSelect)[];
  pecas: (typeof schema.pecas.$inferSelect)[];
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

  // Colunas explícitas, SEM a coluna `texto`: ela pode ter megabytes e viajaria para a tela em
  // toda visita ao processo. O texto é lido sob demanda (pela tool ler_documento).
  const documentos = await db
    .select({
      id: schema.documentos.id,
      processoId: schema.documentos.processoId,
      titulo: schema.documentos.titulo,
      tipo: schema.documentos.tipo,
      categoria: schema.documentos.categoria,
      storagePath: schema.documentos.storagePath,
      arquivoNome: schema.documentos.arquivoNome,
      mimeType: schema.documentos.mimeType,
      tamanhoBytes: schema.documentos.tamanhoBytes,
      paginas: schema.documentos.paginas,
      hashSha256: schema.documentos.hashSha256,
      textoExtraido: schema.documentos.textoExtraido,
      extracaoStatus: schema.documentos.extracaoStatus,
      extraidoEm: schema.documentos.extraidoEm,
      fonte: schema.documentos.fonte,
      enviadoPor: schema.documentos.enviadoPor,
      descricao: schema.documentos.descricao,
      dataDocumento: schema.documentos.dataDocumento,
      createdAt: schema.documentos.createdAt,
    })
    .from(schema.documentos)
    .where(and(eq(schema.documentos.processoId, id), isNull(schema.documentos.excluidoEm)))
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

  const comunicacoes = await db
    .select()
    .from(schema.comunicacoes)
    .where(eq(schema.comunicacoes.processoId, id))
    .orderBy(desc(schema.comunicacoes.dataDisponibilizacao));

  const pecas = await db
    .select()
    .from(schema.pecas)
    .where(eq(schema.pecas.processoId, id))
    .orderBy(desc(schema.pecas.criadoEm));

  return {
    processo,
    prazos,
    movimentacoes,
    documentos,
    anotacoes,
    comunicacoes,
    pecas,
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
  /** Polo do cliente (exequente, executado, réu). Sem isso não se sabe se a decisão é boa. */
  posicao_cliente?: string;
  resumo?: string;
  /** Ato concreto a praticar, nomeado e com dispositivo. */
  acao_necessaria?: string;
  /** Prazo com a data fatal já calculada pela tool. */
  prazo?: string | null;
  /** O que acontece se o advogado não agir (preclusão, trânsito, multa). */
  consequencia?: string;
  severidade?: "critico" | "alto" | "medio" | "baixo";
  pontos?: string[];
  /** Trecho literal do documento que sustenta a conclusão. */
  trecho_fonte?: string;
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

// ============================================================================
// Prazos vencendo (para o alerta via Vercel Cron)
// ============================================================================

export interface PrazoVencendo {
  ato: string;
  dataFatal: string;
  origem: string | null;
  numeroCnj: string | null;
  clienteNome: string | null;
}

/** Prazos não cancelados cuja data fatal cai entre hoje e hoje+dias. */
export async function prazosVencendo(dias: number): Promise<PrazoVencendo[]> {
  if (!db) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      ato: schema.prazos.ato,
      dataFatal: schema.prazos.dataFatal,
      origem: schema.prazos.origem,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
    })
    .from(schema.prazos)
    .leftJoin(schema.processos, eq(schema.prazos.processoId, schema.processos.id))
    .where(
      and(
        ne(schema.prazos.status, "cancelado"),
        gte(schema.prazos.dataFatal, hoje),
        lte(schema.prazos.dataFatal, limite),
      ),
    )
    .orderBy(schema.prazos.dataFatal);
  return rows as PrazoVencendo[];
}

// ============================================================================
// Busca global (processos, clientes, prazos)
// ============================================================================

export interface BuscaResultado {
  processos: { id: string; numeroCnj: string; clienteNome: string | null }[];
  clientes: { id: string; nome: string }[];
  prazos: { id: string; ato: string; dataFatal: string; numeroCnj: string | null }[];
}

/** Busca por número/parte de processo, nome de cliente e ato de prazo. */
export async function buscaGlobal(termo: string): Promise<BuscaResultado> {
  const vazio: BuscaResultado = { processos: [], clientes: [], prazos: [] };
  if (!db || !termo.trim()) return vazio;
  const q = `%${termo.trim()}%`;

  const processos = await db
    .select({
      id: schema.processos.id,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
    })
    .from(schema.processos)
    .where(
      and(
        isNull(schema.processos.excluidoEm),
        or(ilike(schema.processos.numeroCnj, q), ilike(schema.processos.clienteNome, q)),
      ),
    )
    .limit(12);

  const clientes = await db
    .select({ id: schema.clientes.id, nome: schema.clientes.nome })
    .from(schema.clientes)
    .where(ilike(schema.clientes.nome, q))
    .limit(12);

  const prazos = await db
    .select({
      id: schema.prazos.id,
      ato: schema.prazos.ato,
      dataFatal: schema.prazos.dataFatal,
      numeroCnj: schema.processos.numeroCnj,
    })
    .from(schema.prazos)
    .leftJoin(schema.processos, eq(schema.prazos.processoId, schema.processos.id))
    .where(and(ne(schema.prazos.status, "cancelado"), ilike(schema.prazos.ato, q)))
    .limit(12);

  return { processos, clientes, prazos };
}

export interface SaudeColeta {
  fonte: string;
  status: string | null;
  itens: number | null;
  novos: number | null;
  mensagem: string | null;
  quando: Date | null;
  horasAtras: number | null;
}

/**
 * Última coleta de cada fonte, para o alerta diário vigiar a saúde da captação.
 *
 * Existe porque o problema real não foi a coleta falhar: foi ela falhar em silêncio por dez
 * dias, reportando "ok, 0 intimações". Prazo corre enquanto ninguém percebe.
 */
export async function saudeColeta(): Promise<SaudeColeta[]> {
  if (!db) return [];
  const fontes = ["djen", "datajud"];
  const saida: SaudeColeta[] = [];
  for (const fonte of fontes) {
    const [row] = await db
      .select({
        fonte: schema.sincronizacoes.fonte,
        status: schema.sincronizacoes.status,
        itens: schema.sincronizacoes.itens,
        novos: schema.sincronizacoes.novos,
        mensagem: schema.sincronizacoes.mensagem,
        iniciadoEm: schema.sincronizacoes.iniciadoEm,
        concluidoEm: schema.sincronizacoes.concluidoEm,
      })
      .from(schema.sincronizacoes)
      .where(eq(schema.sincronizacoes.fonte, fonte))
      .orderBy(desc(schema.sincronizacoes.iniciadoEm))
      .limit(1);
    const quando = row ? (row.concluidoEm ?? row.iniciadoEm) : null;
    saida.push({
      fonte,
      status: row?.status ?? null,
      itens: row?.itens ?? null,
      novos: row?.novos ?? null,
      mensagem: row?.mensagem ?? null,
      quando,
      horasAtras: quando ? Math.round((Date.now() - new Date(quando).getTime()) / 3600000) : null,
    });
  }
  return saida;
}

/**
 * Dias desde a última intimação NOVA gravada. É o sinal mais honesto de que a captação parou:
 * a coleta pode rodar todo dia, reportar "ok" e mesmo assim não trazer nada há semanas, que foi
 * exatamente o que aconteceu. Null quando nunca houve comunicação.
 */
export async function diasSemIntimacaoNova(): Promise<number | null> {
  if (!db) return null;
  const [row] = await db
    .select({ ultima: sql<Date | null>`max(${schema.comunicacoes.createdAt})` })
    .from(schema.comunicacoes);
  if (!row?.ultima) return null;
  return Math.floor((Date.now() - new Date(row.ultima).getTime()) / 86400000);
}

export interface DetalheIntimacao {
  intimacao: typeof schema.comunicacoes.$inferSelect;
  processo: typeof schema.processos.$inferSelect | null;
  prazos: (typeof schema.prazos.$inferSelect)[];
}

/** Intimação com o inteiro teor, o processo vinculado e os prazos que nasceram dela. */
export async function detalheIntimacao(id: string): Promise<DetalheIntimacao | null> {
  if (!db) return null;
  const [intimacao] = await db
    .select()
    .from(schema.comunicacoes)
    .where(eq(schema.comunicacoes.id, id))
    .limit(1);
  if (!intimacao) return null;

  let processo: typeof schema.processos.$inferSelect | null = null;
  if (intimacao.processoId) {
    [processo] = await db
      .select()
      .from(schema.processos)
      .where(eq(schema.processos.id, intimacao.processoId))
      .limit(1);
  }

  const prazos = await db
    .select()
    .from(schema.prazos)
    .where(eq(schema.prazos.comunicacaoId, id))
    .orderBy(schema.prazos.dataFatal);

  return { intimacao, processo: processo ?? null, prazos };
}
