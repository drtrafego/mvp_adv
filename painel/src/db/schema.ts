/**
 * Schema Drizzle do Gabinete (Postgres / Neon).
 * Espelha supabase/schema.sql. Fonte da verdade do sistema.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const processos = pgTable("processos", {
  id: uuid("id").primaryKey().defaultRandom(),
  numeroCnj: text("numero_cnj").unique().notNull(),
  tribunal: text("tribunal").notNull(),
  classe: text("classe"),
  assunto: text("assunto"),
  orgaoJulgador: text("orgao_julgador"),
  valorCausa: numeric("valor_causa"),
  grau: text("grau"),
  partes: jsonb("partes"),
  clienteNome: text("cliente_nome"),
  fase: text("fase").default("postulatoria"),
  status: text("status").default("ativo"),
  ultimaSincronizacao: timestamp("ultima_sincronizacao", { withTimezone: true }),
  arquivadoEm: timestamp("arquivado_em", { withTimezone: true }),
  excluidoEm: timestamp("excluido_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Histórico de mudança de fase do processo (auditoria do estágio processual).
export const fasesProcesso = pgTable(
  "fases_processo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .references(() => processos.id, { onDelete: "cascade" })
      .notNull(),
    fase: text("fase").notNull(),
    faseAnterior: text("fase_anterior"),
    motivo: text("motivo"),
    autor: text("autor").default("advogado"),
    origem: text("origem").default("humana"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxProc: index("idx_fases_proc").on(t.processoId, t.criadoEm) }),
);

export const movimentacoes = pgTable(
  "movimentacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    codigoCnj: integer("codigo_cnj"),
    descricao: text("descricao").notNull(),
    dataHora: timestamp("data_hora", { withTimezone: true }).notNull(),
    complemento: jsonb("complemento"),
    fonte: text("fonte").default("datajud"),
    criadoPor: text("criado_por"),
    editadoEm: timestamp("editado_em", { withTimezone: true }),
  },
  (t) => ({
    // A dedup real do DataJud é um índice parcial (fonte='datajud'), definido no
    // supabase/schema.sql. Aqui a unique nomeada fica só como documentação da chave.
    uniq: unique("mov_unique").on(t.processoId, t.codigoCnj, t.dataHora),
    idxProc: index("idx_mov_proc").on(t.processoId, t.dataHora),
  }),
);

export const comunicacoes = pgTable(
  "comunicacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id),
    numeroProcesso: text("numero_processo"),
    hashDjen: text("hash_djen").unique(),
    tipo: text("tipo"),
    meio: text("meio").default("DJEN"),
    inteiroTeor: text("inteiro_teor"),
    dataDisponibilizacao: date("data_disponibilizacao"),
    dataPublicacao: date("data_publicacao"),
    oabDestino: text("oab_destino"),
    processada: boolean("processada").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxProc: index("idx_comunic_proc").on(t.processada) }),
);

// Arquivos DO processo, vindos de fora (autos, provas, contratos, decisões). O binário mora no
// Vercel Blob (privado); aqui ficam metadado, hash e o texto extraído para o squad ler.
// Distinção: `documentos` é o que ENTRA; `pecas` é o que o escritório PRODUZ; `modelos_peca` é
// forma e estilo, sem caso. Quando o advogado protocola uma peça, o PDF protocolado entra aqui
// com `pecaId` apontando para a peça que o originou.
export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    titulo: text("titulo"),
    /** Formato normalizado: pdf | docx | imagem | texto. */
    tipo: text("tipo"),
    /** Função processual: inicial, contestacao, decisao, sentenca, prova... (ver lib/documentos). */
    categoria: text("categoria"),
    /** Pathname imutável no Blob: processos/<cnj>/<categoria>/<data>-<slug>-<hash8>.<ext> */
    storagePath: text("storage_path").notNull(),
    arquivoNome: text("arquivo_nome"),
    mimeType: text("mime_type"),
    tamanhoBytes: bigint("tamanho_bytes", { mode: "number" }),
    paginas: integer("paginas"),
    hashSha256: text("hash_sha256"),
    /** Flag: tem texto utilizável. O conteúdo fica na coluna `texto`. */
    textoExtraido: boolean("texto_extraido").default(false),
    texto: text("texto"),
    /** pendente | ok | sem_texto (PDF escaneado) | falhou | nao_aplica */
    extracaoStatus: text("extracao_status").default("pendente"),
    extraidoEm: timestamp("extraido_em", { withTimezone: true }),
    /** Canal de origem: upload_painel | upload_terminal | mni | escavador. */
    fonte: text("fonte"),
    enviadoPor: text("enviado_por"),
    descricao: text("descricao"),
    dataDocumento: date("data_documento"),
    excluidoEm: timestamp("excluido_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxProc: index("idx_docs_proc").on(t.processoId, t.categoria, t.createdAt),
  }),
);

export const analises = pgTable("analises", {
  id: uuid("id").primaryKey().defaultRandom(),
  processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
  documentoId: uuid("documento_id").references(() => documentos.id),
  tipo: text("tipo").notNull(),
  conteudo: jsonb("conteudo").notNull(),
  versao: integer("versao").default(1),
  origem: text("origem").default("maquina"),
  editadoPor: text("editado_por"),
  editadoEm: timestamp("editado_em", { withTimezone: true }),
  modelo: text("modelo"),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  custoUsd: numeric("custo_usd"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Notas livres do advogado sobre um processo, cliente OU prazo (exatamente um alvo).
export const anotacoes = pgTable(
  "anotacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
    prazoId: uuid("prazo_id").references(() => prazos.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    autor: text("autor").default("advogado"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxProc: index("idx_anotacoes_proc").on(t.processoId, t.criadoEm),
    idxCliente: index("idx_anotacoes_cliente").on(t.clienteId, t.criadoEm),
    idxPrazo: index("idx_anotacoes_prazo").on(t.prazoId, t.criadoEm),
  }),
);

// Cadastro de clientes/partes, reaproveitável entre processos.
export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    documento: text("documento"),
    tipoDocumento: text("tipo_documento"),
    email: text("email"),
    telefone: text("telefone"),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxDoc: index("idx_clientes_doc").on(t.documento) }),
);

// Vínculo processo <-> cliente com o papel (autor, réu, terceiro, etc).
export const processoPartes = pgTable(
  "processo_partes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id")
      .references(() => processos.id, { onDelete: "cascade" })
      .notNull(),
    clienteId: uuid("cliente_id")
      .references(() => clientes.id, { onDelete: "cascade" })
      .notNull(),
    papel: text("papel").notNull(),
    principal: boolean("principal").default(false),
  },
  (t) => ({ uniq: unique("processo_partes_unique").on(t.processoId, t.clienteId, t.papel) }),
);

export const prazos = pgTable(
  "prazos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    comunicacaoId: uuid("comunicacao_id").references(() => comunicacoes.id),
    ato: text("ato").notNull(),
    regraAplicada: text("regra_aplicada"),
    dias: integer("dias"),
    contagem: text("contagem").default("uteis"),
    dataPublicacao: date("data_publicacao"),
    dataInicio: date("data_inicio"),
    dataFatalSugerida: date("data_fatal_sugerida").notNull(),
    dataFatal: date("data_fatal").notNull(),
    status: text("status").default("sugerido"),
    origem: text("origem").default("maquina"),
    justificativaIa: text("justificativa_ia"),
    divergencia: jsonb("divergencia"),
    editadoPor: text("editado_por"),
    editadoEm: timestamp("editado_em", { withTimezone: true }),
    alertasEnviados: jsonb("alertas_enviados").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxFatal: index("idx_prazos_fatal").on(t.dataFatal, t.status) }),
);

export const feriadosForenses = pgTable(
  "feriados_forenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tribunal: text("tribunal").notNull(),
    data: date("data").notNull(),
    descricao: text("descricao"),
    tipo: text("tipo").default("feriado"),
  },
  (t) => ({ uniq: unique("feriado_unique").on(t.tribunal, t.data) }),
);

// Autenticacao do painel. Projeto de um advogado so (nao e SaaS): normalmente
// existe um unico usuario. Login por email + senha (hash bcrypt); a sessao vive
// no proprio banco (token opaco no cookie, hash sha256 guardado aqui).
export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  senhaHash: text("senha_hash").notNull(),
  nome: text("nome"),
  oab: text("oab"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const sessoes = pgTable(
  "sessoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .references(() => usuarios.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: text("token_hash").unique().notNull(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxUsuario: index("idx_sessoes_usuario").on(t.usuarioId) }),
);

// Fonte de verdade do "o que foi coletado e quando". Cada busca no DJEN ou no
// DataJud grava uma linha (ok | erro | parcial), para o painel mostrar o status
// da coleta e diferenciar "sem intimação" de "falha na coleta".
export const sincronizacoes = pgTable(
  "sincronizacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fonte: text("fonte").notNull(), // 'djen' | 'datajud'
    escopo: text("escopo"), // ex.: 'OAB 11158/MT' ou numero_cnj
    status: text("status").notNull(), // 'ok' | 'erro' | 'parcial'
    itens: integer("itens").default(0),
    novos: integer("novos").default(0),
    mensagem: text("mensagem"),
    iniciadoEm: timestamp("iniciado_em", { withTimezone: true }).defaultNow(),
    concluidoEm: timestamp("concluido_em", { withTimezone: true }),
  },
  (t) => ({ idxFonte: index("idx_sinc_fonte").on(t.fonte, t.iniciadoEm) }),
);

// Biblioteca de peças-modelo do escritório (upload). O redator usa como base de
// ESTRUTURA e ESTILO, nunca como fonte de citação (a citação vem verificada).
export const modelosPeca = pgTable(
  "modelos_peca",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: text("tipo").notNull(), // inicial | contestacao | recurso | manifestacao | ...
    titulo: text("titulo").notNull(),
    textoExtraido: text("texto_extraido"),
    arquivoNome: text("arquivo_nome"),
    storagePath: text("storage_path"),
    tags: text("tags").array().default([]),
    ativo: boolean("ativo").default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxTipo: index("idx_modelos_tipo").on(t.tipo) }),
);

// Rascunhos de peça gerados pelo squad forense. Nascem origem 'maquina' (amarelo);
// o advogado edita/aprova e vira 'humana' (verde). O motor nunca sobrescreve humano.
export const pecas = pgTable(
  "pecas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
    prazoId: uuid("prazo_id").references(() => prazos.id, { onDelete: "set null" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
    modeloBaseId: uuid("modelo_base_id").references(() => modelosPeca.id),
    tipo: text("tipo").notNull(),
    titulo: text("titulo"),
    conteudo: text("conteudo"),
    status: text("status").default("pendente"), // pendente | gerado | editado | arquivado
    origem: text("origem").default("maquina"),
    versao: integer("versao").default(1),
    editadoPor: text("editado_por"),
    editadoEm: timestamp("editado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ idxProc: index("idx_pecas_processo").on(t.processoId, t.criadoEm) }),
);
