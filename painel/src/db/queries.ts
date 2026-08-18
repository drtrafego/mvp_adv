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
    // O que ainda dá para cumprir vem primeiro, do mais urgente ao menos. O vencido desce para
    // o fim, do mais recente ao mais antigo: ordenar tudo por data fatal crescente jogava um
    // prazo perdido há meses acima do que vence amanhã.
    .orderBy(
      sql`(${schema.prazos.dataFatal} < current_date) asc`,
      sql`case when ${schema.prazos.dataFatal} >= current_date then ${schema.prazos.dataFatal} end asc`,
      sql`${schema.prazos.dataFatal} desc`,
    );
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
  /**
   * De onde veio o cliente exibido: 'humana' (o advogado confirmou, verde), 'maquina' (o motor
   * deduziu do polo único das intimações, amarelo) ou null (só o nome no cache, sem vínculo).
   */
  clienteOrigem: string | null;
}

/**
 * Origem do vínculo processo <-> cliente. Vínculo humano manda: se existe um, é ele que aparece,
 * porque é o que o advogado confirmou.
 *
 * Escrita com nome de tabela literal, e não interpolando as colunas do schema: em query de UMA
 * tabela o Drizzle renderiza a coluna sem o prefixo da tabela, e a subconsulta correlacionada
 * viraria `where "processo_id" = "id"`, comparando duas colunas da própria subconsulta. Não dá
 * erro, só devolve NULL sempre, que é o pior tipo de defeito.
 */
const clienteOrigemSql = sql<string | null>`(
  select pp.origem from processo_partes pp
  where pp.processo_id = processos.id
  order by (pp.origem = 'humana') desc, pp.principal desc nulls last
  limit 1
)`;

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
      clienteOrigem: clienteOrigemSql,
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
  documentos: Omit<
    typeof schema.documentos.$inferSelect,
    "texto" | "excluidoEm" | "pecaId" | "clienteId"
  >[];
  anotacoes: (typeof schema.anotacoes.$inferSelect)[];
  comunicacoes: (typeof schema.comunicacoes.$inferSelect)[];
  pecas: (typeof schema.pecas.$inferSelect)[];
  partes: {
    parte: typeof schema.processoPartes.$inferSelect;
    cliente: typeof schema.clientes.$inferSelect | null;
  }[];
  /**
   * O que a máquina reconheceu dos destinatários das intimações, ainda sem decisão do advogado.
   * Não vem de `processos.partes` (jsonb): aquela coluna é DEPRECADA, porque a API pública do
   * DataJud não devolve partes e ela nasceu vazia.
   */
  partesDetectadas: (typeof schema.partesDetectadas.$inferSelect)[];
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

  const partesDetectadas = await db
    .select()
    .from(schema.partesDetectadas)
    .where(eq(schema.partesDetectadas.processoId, id))
    .orderBy(
      sql`case ${schema.partesDetectadas.status} when 'sugerido' then 0 else 1 end`,
      sql`case ${schema.partesDetectadas.confianca} when 'alta' then 0 when 'media' then 1 else 2 end`,
      asc(schema.partesDetectadas.nome),
    );

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
    partesDetectadas,
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
  /** Já existe prazo nascido desta intimação? Se não, ela ainda espera o cálculo. */
  temPrazo: boolean;
  /** Já existe pré-análise desta intimação? */
  temAnalise: boolean;
  /** Severidade e resultado da análise mais recente (null quando não há análise). */
  severidade: string | null;
  resultado: string | null;
}

// Uma intimação "espera prazo" enquanto nenhum prazo vivo aponta para ela. Prazo cancelado
// não conta: a intimação volta para a fila de quem precisa de análise.
const temPrazoSql = sql<boolean>`exists (
  select 1 from ${schema.prazos}
  where ${schema.prazos.comunicacaoId} = ${schema.comunicacoes.id}
    and ${schema.prazos.status} <> 'cancelado'
)`;

// A fila de pendências ignora o que o advogado já marcou como cuidado (`processada`), porque
// nem toda intimação gera prazo: ciência, mero expediente e juntada só pedem leitura.
const pendenteSql = sql`${schema.comunicacoes.processada} is not true and not ${temPrazoSql}`;

// Análise descartada pelo advogado não conta: para o painel, a intimação volta a ser não analisada.
const temAnaliseSql = sql<boolean>`exists (
  select 1 from ${schema.analises}
  where ${schema.analises.comunicacaoId} = ${schema.comunicacoes.id}
    and coalesce(${schema.analises.status}, 'sugerida') <> 'descartada'
)`;

/** Um campo do conteúdo (jsonb) da análise mais recente da intimação. */
function campoAnaliseSql(campo: string) {
  // O cast para text é o que resolve a ambiguidade do operador ->> com parâmetro (jsonb ->> text
  // e jsonb ->> int existem os dois).
  return sql<string | null>`(
    select ${schema.analises.conteudo}->>(${campo})::text
    from ${schema.analises}
    where ${schema.analises.comunicacaoId} = ${schema.comunicacoes.id}
      and coalesce(${schema.analises.status}, 'sugerida') <> 'descartada'
    order by ${schema.analises.createdAt} desc
    limit 1
  )`;
}

/** Data fatal mais próxima entre os prazos vivos nascidos da intimação. */
const dataFatalSql = sql<string | null>`(
  select ${schema.prazos.dataFatal} from ${schema.prazos}
  where ${schema.prazos.comunicacaoId} = ${schema.comunicacoes.id}
    and ${schema.prazos.status} <> 'cancelado'
  order by ${schema.prazos.dataFatal} asc
  limit 1
)`;

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
      temPrazo: temPrazoSql,
      temAnalise: temAnaliseSql,
      severidade: campoAnaliseSql("severidade"),
      resultado: campoAnaliseSql("resultado"),
    })
    .from(schema.comunicacoes)
    .leftJoin(schema.processos, eq(schema.comunicacoes.processoId, schema.processos.id))
    .orderBy(desc(schema.comunicacoes.dataDisponibilizacao))
    .limit(100);
  return rows as IntimacaoRow[];
}

export interface IntimacaoRecente {
  id: string;
  tipo: string | null;
  dataDisponibilizacao: string | null;
  numeroProcesso: string | null;
  numeroCnj: string | null;
  clienteNome: string | null;
  processada: boolean | null;
  temPrazo: boolean;
  temAnalise: boolean;
  severidade: string | null;
  resultado: string | null;
  acaoNecessaria: string | null;
  dataFatal: string | null;
}

/**
 * O que chegou nos últimos dias, com prazo e análise já agregados. Existe para responder a
 * pergunta que o advogado faz todo dia de manhã: saiu intimação hoje, o que o sistema achou dela?
 */
export async function intimacoesRecentes(dias = 7): Promise<IntimacaoRecente[]> {
  if (!db) return [];
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: schema.comunicacoes.id,
      tipo: schema.comunicacoes.tipo,
      dataDisponibilizacao: schema.comunicacoes.dataDisponibilizacao,
      numeroProcesso: schema.comunicacoes.numeroProcesso,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
      processada: schema.comunicacoes.processada,
      temPrazo: temPrazoSql,
      temAnalise: temAnaliseSql,
      severidade: campoAnaliseSql("severidade"),
      resultado: campoAnaliseSql("resultado"),
      acaoNecessaria: campoAnaliseSql("acao_necessaria"),
      dataFatal: dataFatalSql,
    })
    .from(schema.comunicacoes)
    .leftJoin(schema.processos, eq(schema.comunicacoes.processoId, schema.processos.id))
    .where(gte(schema.comunicacoes.dataDisponibilizacao, desde))
    .orderBy(desc(schema.comunicacoes.dataDisponibilizacao))
    .limit(20);
  return rows as IntimacaoRecente[];
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
  /** Processos ligados a este cliente por vínculo de MÁQUINA, ainda esperando confirmação. */
  processosSugeridos: number;
}

/**
 * Clientes da carteira: une os cadastrados na tabela `clientes` (ex.: importados de planilha) com
 * os nomes que aparecem só nos processos, sem duplicar, conta os processos de cada um e traz o
 * `clienteId` quando o cliente tem cadastro (necessário para abrir o detalhe em /c/[id]).
 *
 * A contagem é pelo VÍNCULO relacional (`processo_partes`). O caminho antigo, por igualdade de
 * nome, continua valendo só para o processo que ainda não tem vínculo nenhum: enquanto existir
 * processo assim, tirar o fallback faria a carteira do cliente parecer vazia.
 */
export async function listarClientes(): Promise<ClienteRow[]> {
  if (!db) return [];
  const res = await db.execute(sql`
    SELECT
      todos.nome AS nome,
      todos.cliente_id AS "clienteId",
      (
        SELECT count(*)::int FROM processos p
        WHERE p.excluido_em IS NULL AND (
          EXISTS (
            SELECT 1 FROM processo_partes pp
            WHERE pp.processo_id = p.id AND pp.cliente_id = todos.cliente_id
          )
          OR (
            p.cliente_nome = todos.nome
            AND NOT EXISTS (SELECT 1 FROM processo_partes x WHERE x.processo_id = p.id)
          )
        )
      ) AS "totalProcessos",
      (
        SELECT count(*)::int FROM processo_partes pp
        JOIN processos p ON p.id = pp.processo_id AND p.excluido_em IS NULL
        WHERE pp.cliente_id = todos.cliente_id AND pp.origem = 'maquina'
      ) AS "processosSugeridos"
    FROM (
      SELECT nome, id AS cliente_id FROM clientes WHERE nome IS NOT NULL AND nome <> ''
      UNION ALL
      SELECT DISTINCT cliente_nome AS nome, NULL::uuid AS cliente_id FROM processos
        WHERE cliente_nome IS NOT NULL AND cliente_nome <> '' AND excluido_em IS NULL
          AND cliente_nome NOT IN (SELECT nome FROM clientes WHERE nome IS NOT NULL AND nome <> '')
    ) todos
    ORDER BY todos.nome
  `);
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows) ?? [];
  return rows as ClienteRow[];
}

export interface ParteAConfirmar {
  id: string;
  processoId: string;
  numeroCnj: string;
  classe: string | null;
  tribunal: string;
  nome: string;
  polo: string | null;
  papelSugerido: string | null;
  fonte: string;
  confianca: string;
  eClienteSugerido: boolean;
  justificativa: string | null;
  trechoFonte: string | null;
  clienteId: string | null;
  /** Trecho do inteiro teor da intimação de origem, para o advogado conferir sem sair da fila. */
  teor: string | null;
}

/**
 * A fila de decisão: o que a máquina reconheceu e ninguém confirmou ainda.
 *
 * Confiança 'alta' significa polo único em todas as intimações do processo, e nesse caso o
 * cliente já está gravado como sugestão (amarelo). 'baixa' e 'media' significam que os dois polos
 * foram intimados: nada foi gravado, de propósito.
 */
export async function partesAConfirmar(): Promise<ParteAConfirmar[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.partesDetectadas.id,
      processoId: schema.partesDetectadas.processoId,
      numeroCnj: schema.processos.numeroCnj,
      classe: schema.processos.classe,
      tribunal: schema.processos.tribunal,
      nome: schema.partesDetectadas.nome,
      polo: schema.partesDetectadas.polo,
      papelSugerido: schema.partesDetectadas.papelSugerido,
      fonte: schema.partesDetectadas.fonte,
      confianca: schema.partesDetectadas.confianca,
      eClienteSugerido: schema.partesDetectadas.eClienteSugerido,
      justificativa: schema.partesDetectadas.justificativa,
      trechoFonte: schema.partesDetectadas.trechoFonte,
      clienteId: schema.partesDetectadas.clienteId,
      // Tira as tags (parte das intimações vem em HTML) e colapsa o espaço. Classe POSIX em vez
      // de '\s+': a barra invertida não sobrevive ao template do Drizzle e o padrão chegava ao
      // Postgres como 's+', que apagava todo "s" do teor.
      teor: sql<string | null>`(
        select left(
          regexp_replace(
            regexp_replace(coalesce(c.inteiro_teor, ''), '<[^>]*>', ' ', 'g'),
            '[[:space:]]+', ' ', 'g'
          ), 2000)
        from comunicacoes c
        where c.processo_id = ${schema.partesDetectadas.processoId}
          and (${schema.partesDetectadas.comunicacaoId} is null
               or c.id = ${schema.partesDetectadas.comunicacaoId})
        order by c.data_disponibilizacao desc nulls last
        limit 1
      )`,
    })
    .from(schema.partesDetectadas)
    .innerJoin(schema.processos, eq(schema.partesDetectadas.processoId, schema.processos.id))
    .where(and(eq(schema.partesDetectadas.status, "sugerido"), isNull(schema.processos.excluidoEm)))
    .orderBy(
      sql`case ${schema.partesDetectadas.confianca} when 'alta' then 0 when 'media' then 1 else 2 end`,
      schema.processos.numeroCnj,
      asc(schema.partesDetectadas.nome),
    )
    .limit(300);
  return rows as ParteAConfirmar[];
}

export interface Resumo {
  totalProcessos: number;
  prazosAbertos: number;
  sugeridos: number;
  venceEm7Dias: number;
  /** Intimações coletadas que ainda não viraram prazo. */
  intimacoesSemPrazo: number;
  /** Intimações não cuidadas que ninguém leu ainda: nem análise, nem baixa. */
  intimacoesSemAnalise: number;
  /** Partes reconhecidas pela máquina esperando a decisão do advogado. */
  partesAConfirmar: number;
  /** Vínculos processo <-> cliente gravados pela máquina, ainda não confirmados (amarelo). */
  clientesSugeridos: number;
}

export async function resumo(): Promise<Resumo> {
  if (!db)
    return {
      totalProcessos: 0,
      prazosAbertos: 0,
      sugeridos: 0,
      venceEm7Dias: 0,
      intimacoesSemPrazo: 0,
      intimacoesSemAnalise: 0,
      partesAConfirmar: 0,
      clientesSugeridos: 0,
    };
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
  const [isp] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.comunicacoes)
    .where(pendenteSql);
  const [isa] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.comunicacoes)
    .where(sql`${schema.comunicacoes.processada} is not true and not ${temAnaliseSql}`);
  const [pac] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.partesDetectadas)
    .where(eq(schema.partesDetectadas.status, "sugerido"));
  const [cls] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.processoPartes)
    .where(eq(schema.processoPartes.origem, "maquina"));
  return {
    totalProcessos: tp?.n ?? 0,
    prazosAbertos: pa?.n ?? 0,
    sugeridos: sg?.n ?? 0,
    venceEm7Dias: v7?.n ?? 0,
    intimacoesSemPrazo: isp?.n ?? 0,
    intimacoesSemAnalise: isa?.n ?? 0,
    partesAConfirmar: pac?.n ?? 0,
    clientesSugeridos: cls?.n ?? 0,
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

  // Documentos do CASO, presos à peça: numa inicial ainda não existe processo, mas já existe
  // contrato, comprovante e procuração para o squad usar. Sem a coluna `texto` (pesada).
  const documentos = await db
    .select({
      id: schema.documentos.id,
      titulo: schema.documentos.titulo,
      tipo: schema.documentos.tipo,
      categoria: schema.documentos.categoria,
      tamanhoBytes: schema.documentos.tamanhoBytes,
      paginas: schema.documentos.paginas,
      extracaoStatus: schema.documentos.extracaoStatus,
      descricao: schema.documentos.descricao,
      dataDocumento: schema.documentos.dataDocumento,
      createdAt: schema.documentos.createdAt,
    })
    .from(schema.documentos)
    .where(and(eq(schema.documentos.pecaId, id), isNull(schema.documentos.excluidoEm)))
    .orderBy(desc(schema.documentos.createdAt));

  return { peca, processo: processo ?? null, documentos };
}

// ============================================================================
// Detalhe de cliente e de prazo (modais)
// ============================================================================

export interface ProcessoDoCliente extends ProcessoRow {
  /**
   * humana: o advogado confirmou o vínculo. maquina: o motor deduziu do polo único (amarelo).
   * nome: não há vínculo relacional, o processo só bate pelo cache `cliente_nome` (legado).
   */
  vinculo: "humana" | "maquina" | "nome";
  papel: string | null;
}

export interface DocumentoDoCliente {
  id: string;
  titulo: string | null;
  tipo: string | null;
  categoria: string | null;
  tamanhoBytes: number | null;
  paginas: number | null;
  extracaoStatus: string | null;
  descricao: string | null;
  dataDocumento: string | null;
  createdAt: Date | null;
  processoId: string | null;
  numeroCnj: string | null;
  pecaId: string | null;
  /** processo | peca | direto: por onde o documento chegou à pasta do cliente. */
  via: string;
}

export interface DetalheCliente {
  cliente: typeof schema.clientes.$inferSelect;
  processos: ProcessoDoCliente[];
  documentos: DocumentoDoCliente[];
  anotacoes: (typeof schema.anotacoes.$inferSelect)[];
  pecas: (typeof schema.pecas.$inferSelect)[];
}

/**
 * Processos do cliente pelo VÍNCULO relacional (`processo_partes`), com o caminho antigo (nome
 * igual em `processos.cliente_nome`) como rede de segurança, marcado como 'nome'. O fallback só
 * pega processo que não tem vínculo nenhum: quando toda a carteira estiver vinculada, ele para de
 * devolver linha sozinho.
 */
async function processosDoCliente(clienteId: string, nome: string): Promise<ProcessoDoCliente[]> {
  if (!db) return [];
  const res = await db.execute(sql`
    SELECT p.id, p.numero_cnj AS "numeroCnj", p.cliente_nome AS "clienteNome", p.classe,
           p.tribunal, p.fase, p.status,
           p.ultima_sincronizacao AS "ultimaSincronizacao", p.arquivado_em AS "arquivadoEm",
           CASE WHEN pp.id IS NULL THEN 'nome' ELSE coalesce(pp.origem, 'humana') END AS vinculo,
           CASE WHEN pp.id IS NULL THEN 'humana' ELSE coalesce(pp.origem, 'humana') END AS "clienteOrigem",
           pp.papel AS papel
    FROM processos p
    LEFT JOIN processo_partes pp ON pp.processo_id = p.id AND pp.cliente_id = ${clienteId}
    WHERE p.excluido_em IS NULL
      AND (
        pp.id IS NOT NULL
        OR (
          p.cliente_nome = ${nome}
          AND NOT EXISTS (SELECT 1 FROM processo_partes x WHERE x.processo_id = p.id)
        )
      )
    ORDER BY p.ultima_sincronizacao DESC NULLS LAST
  `);
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows) ?? [];
  return rows as ProcessoDoCliente[];
}

/**
 * A pasta do cliente: os três caminhos por onde um documento chega até ele, sem a coluna `texto`
 * (ela tem megabytes e não se lê na tela).
 *
 * 1. documentos dos processos do cliente (via `processo_partes`);
 * 2. documentos presos às peças do cliente (caso novo, ainda sem processo);
 * 3. documentos com `cliente_id` direto (preenchido só a partir de vínculo humano).
 */
export async function documentosDoCliente(clienteId: string): Promise<DocumentoDoCliente[]> {
  if (!db) return [];
  const res = await db.execute(sql`
    SELECT DISTINCT ON (d.id)
      d.id, d.titulo, d.tipo, d.categoria,
      d.tamanho_bytes AS "tamanhoBytes", d.paginas,
      d.extracao_status AS "extracaoStatus", d.descricao,
      d.data_documento AS "dataDocumento", d.created_at AS "createdAt",
      d.processo_id AS "processoId", p.numero_cnj AS "numeroCnj", d.peca_id AS "pecaId",
      CASE
        WHEN d.cliente_id = ${clienteId} THEN 'direto'
        WHEN d.peca_id IS NOT NULL AND pe.cliente_id = ${clienteId} THEN 'peca'
        ELSE 'processo'
      END AS via
    FROM documentos d
    LEFT JOIN processos p ON p.id = d.processo_id
    LEFT JOIN pecas pe ON pe.id = d.peca_id
    WHERE d.excluido_em IS NULL
      AND (
        d.cliente_id = ${clienteId}
        OR pe.cliente_id = ${clienteId}
        OR EXISTS (
          SELECT 1 FROM processo_partes pp
          WHERE pp.processo_id = d.processo_id AND pp.cliente_id = ${clienteId}
        )
      )
    ORDER BY d.id, d.created_at DESC
  `);
  const rows = ((Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows) ??
    []) as DocumentoDoCliente[];
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
}

/** Cliente + processos vinculados + documentos + anotações + peças: a pasta do cliente. */
export async function detalheCliente(id: string): Promise<DetalheCliente | null> {
  if (!db) return null;
  const [cliente] = await db
    .select()
    .from(schema.clientes)
    .where(eq(schema.clientes.id, id))
    .limit(1);
  if (!cliente) return null;

  const processos = await processosDoCliente(id, cliente.nome);
  const documentos = await documentosDoCliente(id);

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

  return { cliente, processos, documentos, anotacoes, pecas };
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

export interface AnaliseItem {
  id: string;
  tipo: string;
  conteudo: AnaliseConteudo;
  versao: number | null;
  status: string | null;
  origem: string | null;
  modelo: string | null;
  editadoPor: string | null;
  editadoEm: Date | null;
  createdAt: Date | null;
}

export interface DetalheIntimacao {
  intimacao: typeof schema.comunicacoes.$inferSelect;
  processo: typeof schema.processos.$inferSelect | null;
  prazos: (typeof schema.prazos.$inferSelect)[];
  /** Pré-análises desta intimação, da mais recente para a mais antiga. */
  analises: AnaliseItem[];
}

/**
 * Intimação com o inteiro teor, o processo vinculado, os prazos que nasceram dela e as
 * pré-análises. Sem as análises aqui, o advogado abria a intimação do dia e não achava em lugar
 * nenhum o que o sistema tinha lido dela.
 */
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

  const analises = (await db
    .select({
      id: schema.analises.id,
      tipo: schema.analises.tipo,
      conteudo: schema.analises.conteudo,
      versao: schema.analises.versao,
      status: schema.analises.status,
      origem: schema.analises.origem,
      modelo: schema.analises.modelo,
      editadoPor: schema.analises.editadoPor,
      editadoEm: schema.analises.editadoEm,
      createdAt: schema.analises.createdAt,
    })
    .from(schema.analises)
    .where(eq(schema.analises.comunicacaoId, id))
    .orderBy(desc(schema.analises.createdAt))) as AnaliseItem[];

  return { intimacao, processo: processo ?? null, prazos, analises };
}

export interface AcessoRow {
  id: string;
  email: string;
  nome: string | null;
  oab: string | null;
  criadoEm: string | null;
  sessoesAtivas: number;
}

/** Lista quem tem acesso ao painel, com a contagem de sessões ainda válidas. */
export async function listarAcessos(): Promise<AcessoRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.usuarios.id,
      email: schema.usuarios.email,
      nome: schema.usuarios.nome,
      oab: schema.usuarios.oab,
      criadoEm: schema.usuarios.criadoEm,
      // Tabela e coluna literais de propósito: interpolar o schema numa subconsulta que vive na
      // lista do SELECT sem join faz o Drizzle renderizar sem o prefixo da tabela, e a correlação
      // virava `where "usuario_id" = "id"` (duas colunas de `sessoes`), devolvendo sempre 0.
      sessoesAtivas: sql<number>`(
        select count(*)::int from sessoes s
        where s.usuario_id = usuarios.id and s.expira_em > now()
      )`,
    })
    .from(schema.usuarios)
    .orderBy(asc(schema.usuarios.criadoEm));
  return rows as unknown as AcessoRow[];
}
