"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const FASES_VALIDAS = [
  "postulatoria",
  "contestacao",
  "saneamento",
  "instrucao",
  "sentenca",
  "recurso",
  "cumprimento",
  "arquivado",
] as const;

/** Confirma um prazo: status 'confirmado', origem 'humana'. O motor não sobrescreve mais. */
export async function confirmarPrazoAction(prazoId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.prazos)
    .set({ status: "confirmado", origem: "humana", editadoPor: "advogado", editadoEm: new Date() })
    .where(eq(schema.prazos.id, prazoId));
  revalidatePath("/");
  return { ok: true };
}

/** Edita a data fatal e/ou o ato de um prazo, marcando origem 'humana'. */
export async function editarPrazoAction(
  prazoId: string,
  patch: { dataFatal?: string; ato?: string },
) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.prazos)
    .set({
      status: "editado",
      origem: "humana",
      editadoPor: "advogado",
      editadoEm: new Date(),
      ...(patch.dataFatal ? { dataFatal: patch.dataFatal } : {}),
      ...(patch.ato ? { ato: patch.ato } : {}),
    })
    .where(eq(schema.prazos.id, prazoId));
  revalidatePath("/");
  return { ok: true };
}

/** Cancela um prazo (some da lista ativa). */
export async function cancelarPrazoAction(prazoId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.prazos)
    .set({ status: "cancelado", origem: "humana", editadoPor: "advogado", editadoEm: new Date() })
    .where(eq(schema.prazos.id, prazoId));
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Fase / estágio processual
// ============================================================================

/** Muda a fase do processo e grava a mudança no histórico `fases_processo`. */
export async function mudarFaseAction(processoId: string, fase: string, motivo?: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!FASES_VALIDAS.includes(fase as (typeof FASES_VALIDAS)[number])) {
    return { ok: false, erro: "Fase inválida." };
  }

  const [proc] = await db
    .select({ fase: schema.processos.fase })
    .from(schema.processos)
    .where(eq(schema.processos.id, processoId))
    .limit(1);
  if (!proc) return { ok: false, erro: "Processo não encontrado." };

  await db.update(schema.processos).set({ fase }).where(eq(schema.processos.id, processoId));
  await db.insert(schema.fasesProcesso).values({
    processoId,
    fase,
    faseAnterior: proc.fase,
    motivo: motivo?.trim() || null,
    autor: "advogado",
    origem: "humana",
  });
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Movimentações manuais (as automáticas do DataJud são read-only)
// ============================================================================

/** Adiciona uma movimentação manual (fonte 'manual', editável/removível). */
export async function adicionarMovimentacaoManualAction(
  processoId: string,
  dados: { descricao: string; dataHora: string },
) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const descricao = dados.descricao?.trim();
  if (!descricao) return { ok: false, erro: "Descrição obrigatória." };
  const dataHora = new Date(dados.dataHora);
  if (Number.isNaN(dataHora.getTime())) return { ok: false, erro: "Data inválida." };

  await db.insert(schema.movimentacoes).values({
    processoId,
    descricao,
    dataHora,
    fonte: "manual",
    criadoPor: "advogado",
  });
  revalidatePath("/");
  return { ok: true };
}

/** Edita uma movimentação, apenas se for manual. Automáticas do DataJud são read-only. */
export async function editarMovimentacaoAction(
  movId: string,
  patch: { descricao?: string; dataHora?: string },
) {
  if (!db) return { ok: false, erro: "Banco não conectado." };

  const [mov] = await db
    .select({ fonte: schema.movimentacoes.fonte })
    .from(schema.movimentacoes)
    .where(eq(schema.movimentacoes.id, movId))
    .limit(1);
  if (!mov) return { ok: false, erro: "Movimentação não encontrada." };
  if (mov.fonte !== "manual") {
    return { ok: false, erro: "Movimentação automática do DataJud não pode ser editada." };
  }

  const set: { descricao?: string; dataHora?: Date; editadoEm: Date } = { editadoEm: new Date() };
  if (patch.descricao !== undefined) {
    const descricao = patch.descricao.trim();
    if (!descricao) return { ok: false, erro: "Descrição obrigatória." };
    set.descricao = descricao;
  }
  if (patch.dataHora !== undefined) {
    const dataHora = new Date(patch.dataHora);
    if (Number.isNaN(dataHora.getTime())) return { ok: false, erro: "Data inválida." };
    set.dataHora = dataHora;
  }

  await db.update(schema.movimentacoes).set(set).where(eq(schema.movimentacoes.id, movId));
  revalidatePath("/");
  return { ok: true };
}

/** Remove uma movimentação, apenas se for manual. */
export async function removerMovimentacaoAction(movId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };

  const [mov] = await db
    .select({ fonte: schema.movimentacoes.fonte })
    .from(schema.movimentacoes)
    .where(eq(schema.movimentacoes.id, movId))
    .limit(1);
  if (!mov) return { ok: false, erro: "Movimentação não encontrada." };
  if (mov.fonte !== "manual") {
    return { ok: false, erro: "Movimentação automática do DataJud não pode ser removida." };
  }

  await db.delete(schema.movimentacoes).where(eq(schema.movimentacoes.id, movId));
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Anotações
// ============================================================================

/** Cria uma anotação livre no processo. */
export async function adicionarAnotacaoAction(processoId: string, texto: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };

  await db.insert(schema.anotacoes).values({ processoId, texto: conteudo, autor: "advogado" });
  revalidatePath("/");
  return { ok: true };
}

/** Edita o texto de uma anotação e carimba `atualizadoEm`. */
export async function editarAnotacaoAction(anotacaoId: string, texto: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };

  await db
    .update(schema.anotacoes)
    .set({ texto: conteudo, atualizadoEm: new Date() })
    .where(eq(schema.anotacoes.id, anotacaoId));
  revalidatePath("/");
  return { ok: true };
}

/** Remove uma anotação. */
export async function removerAnotacaoAction(anotacaoId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db.delete(schema.anotacoes).where(eq(schema.anotacoes.id, anotacaoId));
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Cliente / partes
// ============================================================================

export interface DadosCliente {
  id?: string;
  nome: string;
  documento?: string;
  tipoDocumento?: string;
  email?: string;
  telefone?: string;
  observacoes?: string;
  principal?: boolean;
}

/**
 * Salva o cliente (insere ou atualiza), vincula ao processo com o papel informado
 * e atualiza o cache `processos.clienteNome`.
 */
export async function salvarClienteAction(
  processoId: string,
  dados: DadosCliente,
  papel: string,
) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const nome = dados.nome?.trim();
  if (!nome) return { ok: false, erro: "Nome obrigatório." };
  const papelNorm = papel?.trim();
  if (!papelNorm) return { ok: false, erro: "Papel obrigatório." };

  const valores = {
    nome,
    documento: dados.documento?.trim() || null,
    tipoDocumento: dados.tipoDocumento?.trim() || null,
    email: dados.email?.trim() || null,
    telefone: dados.telefone?.trim() || null,
    observacoes: dados.observacoes?.trim() || null,
  };

  let clienteId = dados.id;
  if (clienteId) {
    await db.update(schema.clientes).set(valores).where(eq(schema.clientes.id, clienteId));
  } else {
    const [novo] = await db.insert(schema.clientes).values(valores).returning({ id: schema.clientes.id });
    clienteId = novo.id;
  }

  await db
    .insert(schema.processoPartes)
    .values({
      processoId,
      clienteId,
      papel: papelNorm,
      principal: dados.principal ?? false,
    })
    .onConflictDoUpdate({
      target: [
        schema.processoPartes.processoId,
        schema.processoPartes.clienteId,
        schema.processoPartes.papel,
      ],
      set: { principal: dados.principal ?? false },
    });

  await db
    .update(schema.processos)
    .set({ clienteNome: nome })
    .where(eq(schema.processos.id, processoId));

  revalidatePath("/");
  return { ok: true, clienteId };
}

// ============================================================================
// Arquivar / excluir (soft-delete)
// ============================================================================

/** Arquiva o processo: sai da rotina de sync, continua consultável e reversível. */
export async function arquivarProcessoAction(processoId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.processos)
    .set({ status: "arquivado", arquivadoEm: new Date() })
    .where(eq(schema.processos.id, processoId));
  revalidatePath("/");
  return { ok: true };
}

/** Desarquiva o processo, voltando ao status ativo. */
export async function desarquivarProcessoAction(processoId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.processos)
    .set({ status: "ativo", arquivadoEm: null })
    .where(eq(schema.processos.id, processoId));
  revalidatePath("/");
  return { ok: true };
}

/** Exclui o processo por soft-delete: some da UI, recuperável por 30 dias. */
export async function excluirProcessoAction(processoId: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.processos)
    .set({ status: "excluido", excluidoEm: new Date() })
    .where(eq(schema.processos.id, processoId));
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Anotações de cliente e de prazo (a de processo é adicionarAnotacaoAction)
// ============================================================================

/** Cria uma anotação livre num cliente. */
export async function adicionarAnotacaoClienteAction(clienteId: string, texto: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };
  await db.insert(schema.anotacoes).values({ clienteId, texto: conteudo, autor: "advogado" });
  revalidatePath("/");
  return { ok: true };
}

/** Cria uma anotação livre num prazo. */
export async function adicionarAnotacaoPrazoAction(prazoId: string, texto: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };
  await db.insert(schema.anotacoes).values({ prazoId, texto: conteudo, autor: "advogado" });
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Modelos-peça do escritório (banco de peças)
// ============================================================================

/** Salva uma peça-modelo do escritório (upload nas Configurações). */
export async function salvarModeloAction(dados: {
  tipo: string;
  titulo: string;
  textoExtraido?: string;
  arquivoNome?: string;
  tags?: string[];
}) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const tipo = dados.tipo?.trim();
  const titulo = dados.titulo?.trim();
  if (!tipo || !titulo) return { ok: false, erro: "Tipo e título são obrigatórios." };
  const [row] = await db
    .insert(schema.modelosPeca)
    .values({
      tipo,
      titulo,
      textoExtraido: dados.textoExtraido?.trim() || null,
      arquivoNome: dados.arquivoNome?.trim() || null,
      tags: dados.tags ?? [],
    })
    .returning({ id: schema.modelosPeca.id });
  revalidatePath("/");
  return { ok: true, id: row.id };
}

/** Desativa (aposenta) um modelo sem apagar. */
export async function removerModeloAction(id: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db.update(schema.modelosPeca).set({ ativo: false }).where(eq(schema.modelosPeca.id, id));
  revalidatePath("/");
  return { ok: true };
}

// ============================================================================
// Peças (rascunhos gerados). Fluxo MVP: o painel cria a peça pendente e devolve
// o comando para o advogado rodar o squad forense no Claude Code (que salva via
// a tool salvar_peca). O painel exibe, edita e aprova o rascunho.
// ============================================================================

/**
 * Cria uma peça pendente (origem 'maquina') e devolve o comando pronto para o
 * advogado colar no Claude Code. A geração em si (pesquisador -> redator -> revisor)
 * roda no terminal e preenche a peça via a tool salvar_peca.
 */
export async function gerarPecaAction(dados: {
  tipo: string;
  processoId?: string;
  prazoId?: string;
  clienteId?: string;
}) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const tipo = dados.tipo?.trim();
  if (!tipo) return { ok: false, erro: "Tipo da peça é obrigatório." };
  const [row] = await db
    .insert(schema.pecas)
    .values({
      tipo,
      processoId: dados.processoId ?? null,
      prazoId: dados.prazoId ?? null,
      clienteId: dados.clienteId ?? null,
      status: "pendente",
      origem: "maquina",
    })
    .returning({ id: schema.pecas.id });
  revalidatePath("/");
  const alvo = dados.prazoId
    ? `do prazo ${dados.prazoId}`
    : dados.processoId
      ? `do processo ${dados.processoId}`
      : "de caso novo";
  const comando =
    `Gera um rascunho de ${tipo} ${alvo} (peca_id ${row.id}). ` +
    `Aciona o forense: pesquisador-juridico verifica os fundamentos, o redator-forense ` +
    `redige usando os modelos do escritorio (buscar_modelos), o revisor-juridico audita as ` +
    `citacoes, e salva com a tool salvar_peca informando peca_id=${row.id}.`;
  return { ok: true, id: row.id, comando };
}

/** Edita o conteúdo de uma peça: origem 'humana', status 'editado'. O motor não sobrescreve mais. */
export async function editarPecaAction(id: string, conteudo: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.pecas)
    .set({
      conteudo,
      status: "editado",
      origem: "humana",
      editadoPor: "advogado",
      editadoEm: new Date(),
      atualizadoEm: new Date(),
    })
    .where(eq(schema.pecas.id, id));
  revalidatePath("/");
  return { ok: true };
}

/** Aprova a peça (origem 'humana') sem alterar o texto. */
export async function confirmarPecaAction(id: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db
    .update(schema.pecas)
    .set({ origem: "humana", editadoPor: "advogado", editadoEm: new Date() })
    .where(eq(schema.pecas.id, id));
  revalidatePath("/");
  return { ok: true };
}

/** Arquiva uma peça (some da lista ativa). */
export async function removerPecaAction(id: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  await db.update(schema.pecas).set({ status: "arquivado" }).where(eq(schema.pecas.id, id));
  revalidatePath("/");
  return { ok: true };
}

/** Atualiza os dados de um cliente (usado no modal de detalhe do cliente). */
export async function atualizarClienteAction(
  id: string,
  dados: {
    nome?: string;
    documento?: string;
    tipoDocumento?: string;
    email?: string;
    telefone?: string;
    observacoes?: string;
  },
) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const set: Record<string, string | null> = {};
  if (dados.nome !== undefined) {
    const n = dados.nome.trim();
    if (!n) return { ok: false, erro: "Nome é obrigatório." };
    set.nome = n;
  }
  if (dados.documento !== undefined) set.documento = dados.documento.trim() || null;
  if (dados.tipoDocumento !== undefined) set.tipoDocumento = dados.tipoDocumento.trim() || null;
  if (dados.email !== undefined) set.email = dados.email.trim() || null;
  if (dados.telefone !== undefined) set.telefone = dados.telefone.trim() || null;
  if (dados.observacoes !== undefined) set.observacoes = dados.observacoes.trim() || null;
  await db.update(schema.clientes).set(set).where(eq(schema.clientes.id, id));
  revalidatePath("/");
  return { ok: true };
}

/** Cria um cliente novo pelo nome (para os que só existem como texto no processo). */
export async function criarClienteAction(nome: string) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const n = nome?.trim();
  if (!n) return { ok: false, erro: "Nome é obrigatório." };
  const [row] = await db
    .insert(schema.clientes)
    .values({ nome: n })
    .returning({ id: schema.clientes.id });
  revalidatePath("/");
  return { ok: true, id: row.id };
}

// ============================================================================
// Aba Inicial (caso novo). Cria a peça 'inicial' guardando os fatos como briefing
// (base para o construtor-tese), e um cliente pelo nome se ainda não existir.
// ============================================================================

export async function iniciarInicialAction(dados: { clienteNome?: string; fatos: string }) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const fatos = dados.fatos?.trim();
  if (!fatos) return { ok: false, erro: "Descreva os fatos do caso." };

  let clienteId: string | undefined;
  const nome = dados.clienteNome?.trim();
  if (nome) {
    const [ex] = await db
      .select({ id: schema.clientes.id })
      .from(schema.clientes)
      .where(eq(schema.clientes.nome, nome))
      .limit(1);
    if (ex) {
      clienteId = ex.id;
    } else {
      const [novo] = await db
        .insert(schema.clientes)
        .values({ nome })
        .returning({ id: schema.clientes.id });
      clienteId = novo.id;
    }
  }

  const [row] = await db
    .insert(schema.pecas)
    .values({
      tipo: "inicial",
      clienteId: clienteId ?? null,
      titulo: nome ? `Inicial — ${nome}` : "Petição inicial",
      conteudo: `BRIEFING (fatos do caso, base para o construtor-tese):\n\n${fatos}`,
      status: "pendente",
      origem: "maquina",
    })
    .returning({ id: schema.pecas.id });
  revalidatePath("/");
  return { ok: true, id: row.id };
}

// ============================================================================
// Protocolar a inicial: cria o processo na carteira. NÃO peticiona nem protocola
// no tribunal (isso é do advogado). Aqui só registramos que o caso virou processo,
// com o número que o advogado informar após protocolar manualmente.
// ============================================================================

export async function protocolarInicialAction(
  pecaId: string,
  dados: { numeroCnj: string; tribunal: string; clienteNome?: string },
) {
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const numeroCnj = dados.numeroCnj?.trim();
  const tribunal = dados.tribunal?.trim();
  if (!numeroCnj || !tribunal) {
    return { ok: false, erro: "Informe o número CNJ e o tribunal do processo protocolado." };
  }

  const [proc] = await db
    .insert(schema.processos)
    .values({
      numeroCnj,
      tribunal,
      clienteNome: dados.clienteNome?.trim() || null,
      fase: "postulatoria",
      status: "ativo",
    })
    .onConflictDoNothing()
    .returning({ id: schema.processos.id });

  let processoId = proc?.id;
  if (!processoId) {
    const [ex] = await db
      .select({ id: schema.processos.id })
      .from(schema.processos)
      .where(eq(schema.processos.numeroCnj, numeroCnj))
      .limit(1);
    processoId = ex?.id;
  }
  if (!processoId) return { ok: false, erro: "Não foi possível criar o processo." };

  await db.update(schema.pecas).set({ processoId }).where(eq(schema.pecas.id, pecaId));
  revalidatePath("/");
  return { ok: true, processoId };
}
