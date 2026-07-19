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
