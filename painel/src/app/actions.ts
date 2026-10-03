"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { getUsuarioAtual } from "@/lib/auth";
import { ehDataIso, ehHashSha256, ehUuid, textoValido } from "@/lib/seguranca";
import { normalizarNome, papelDoPolo, poloOposto } from "@/lib/partes";

// As actions podem ser chamadas diretamente por HTTP; nunca dependem do layout.
async function sessaoParaMutacao() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { erro: "Sessão expirada. Entre de novo." };
  return { autor: `${usuario.email} (${usuario.id})` };
}

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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(prazoId)) return { ok: false, erro: "Identificador inválido." };
  const [atualizado] = await db
    .update(schema.prazos)
    .set({ status: "confirmado", origem: "humana", editadoPor: sessao.autor, editadoEm: new Date() })
    .where(and(eq(schema.prazos.id, prazoId), ne(schema.prazos.status, "cancelado")))
    .returning({ id: schema.prazos.id });
  if (!atualizado) return { ok: false, erro: "Prazo não encontrado ou já cancelado." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edita a data fatal e/ou o ato de um prazo, marcando origem 'humana'. */
export async function editarPrazoAction(
  prazoId: string,
  patch: { dataFatal?: string; ato?: string },
) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(prazoId)) return { ok: false, erro: "Identificador inválido." };
  if (!patch || (patch.dataFatal !== undefined && !ehDataIso(patch.dataFatal)) ||
      (patch.ato !== undefined && !textoValido(patch.ato, 1000))) {
    return { ok: false, erro: "Informe um ato válido e uma data real no formato AAAA-MM-DD." };
  }
  if (patch.dataFatal === undefined && patch.ato === undefined) return { ok: false, erro: "Nada para alterar." };
  const [atualizado] = await db
    .update(schema.prazos)
    .set({
      status: "editado",
      origem: "humana",
      editadoPor: sessao.autor,
      editadoEm: new Date(),
      ...(patch.dataFatal ? { dataFatal: patch.dataFatal } : {}),
      ...(patch.ato ? { ato: patch.ato } : {}),
    })
    .where(and(eq(schema.prazos.id, prazoId), ne(schema.prazos.status, "cancelado")))
    .returning({ id: schema.prazos.id });
  if (!atualizado) return { ok: false, erro: "Prazo não encontrado ou já cancelado." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cancela um prazo (some da lista ativa). */
export async function cancelarPrazoAction(prazoId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(prazoId)) return { ok: false, erro: "Identificador inválido." };
  await db
    .update(schema.prazos)
    .set({ status: "cancelado", origem: "humana", editadoPor: sessao.autor, editadoEm: new Date() })
    .where(eq(schema.prazos.id, prazoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================================
// Fase / estágio processual
// ============================================================================

/** Muda a fase do processo e grava a mudança no histórico `fases_processo`. */
export async function mudarFaseAction(processoId: string, fase: string, motivo?: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
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
    autor: sessao.autor,
    origem: "humana",
  });
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
  const descricao = dados.descricao?.trim();
  if (!descricao) return { ok: false, erro: "Descrição obrigatória." };
  const dataHora = new Date(dados.dataHora);
  if (Number.isNaN(dataHora.getTime())) return { ok: false, erro: "Data inválida." };

  await db.insert(schema.movimentacoes).values({
    processoId,
    descricao,
    dataHora,
    fonte: "manual",
    criadoPor: sessao.autor,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edita uma movimentação, apenas se for manual. Automáticas do DataJud são read-only. */
export async function editarMovimentacaoAction(
  movId: string,
  patch: { descricao?: string; dataHora?: string },
) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(movId)) return { ok: false, erro: "Identificador inválido." };

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
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove uma movimentação, apenas se for manual. */
export async function removerMovimentacaoAction(movId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(movId)) return { ok: false, erro: "Identificador inválido." };

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
  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================================
// Anotações
// ============================================================================

/** Cria uma anotação livre no processo. */
export async function adicionarAnotacaoAction(processoId: string, texto: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };

  await db.insert(schema.anotacoes).values({ processoId, texto: conteudo, autor: sessao.autor });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edita o texto de uma anotação e carimba `atualizadoEm`. */
export async function editarAnotacaoAction(anotacaoId: string, texto: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(anotacaoId)) return { ok: false, erro: "Identificador inválido." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };

  await db
    .update(schema.anotacoes)
    .set({ texto: conteudo, atualizadoEm: new Date() })
    .where(eq(schema.anotacoes.id, anotacaoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove uma anotação. */
export async function removerAnotacaoAction(anotacaoId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(anotacaoId)) return { ok: false, erro: "Identificador inválido." };
  await db.delete(schema.anotacoes).where(eq(schema.anotacoes.id, anotacaoId));
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
  const nome = dados.nome?.trim();
  if (!nome) return { ok: false, erro: "Nome obrigatório." };
  if (!textoValido(nome, 200) || (dados.id && !ehUuid(dados.id))) return { ok: false, erro: "Nome ou cliente inválido." };
  const papelNorm = papel?.trim();
  if (!textoValido(papelNorm, 100)) return { ok: false, erro: "Papel obrigatório com até 100 caracteres." };
  const [processoAlvo] = await db.select({ id: schema.processos.id }).from(schema.processos)
    .where(eq(schema.processos.id, processoId)).limit(1);
  if (!processoAlvo) return { ok: false, erro: "Processo não encontrado." };

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
    const [atualizado] = await db.update(schema.clientes).set(valores).where(eq(schema.clientes.id, clienteId)).returning({ id: schema.clientes.id });
    if (!atualizado) return { ok: false, erro: "Cliente não encontrado." };
  } else {
    const [novo] = await db.insert(schema.clientes).values(valores).returning({ id: schema.clientes.id });
    clienteId = novo.id;
  }

  // Veio do formulário: é palavra do advogado, então nasce 'humana' e o motor não sobrescreve.
  const agora = new Date();
  await db
    .insert(schema.processoPartes)
    .values({
      processoId,
      clienteId,
      papel: papelNorm,
      principal: dados.principal ?? false,
      origem: "humana",
      confirmadoPor: sessao.autor,
      confirmadoEm: agora,
    })
    .onConflictDoUpdate({
      target: [
        schema.processoPartes.processoId,
        schema.processoPartes.clienteId,
        schema.processoPartes.papel,
      ],
      set: {
        principal: dados.principal ?? false,
        origem: "humana",
        confirmadoPor: sessao.autor,
        confirmadoEm: agora,
      },
    });

  if (dados.principal) {
    await db.update(schema.processos).set({ clienteNome: nome }).where(eq(schema.processos.id, processoId));
  }

  revalidatePath("/", "layout");
  return { ok: true, clienteId };
}

// ============================================================================
// Partes reconhecidas pela máquina: a decisão do advogado
//
// A máquina propõe (origem 'maquina', amarelo); aqui o advogado dispõe, e o vínculo vira
// 'humana' (verde), que o motor nunca mais sobrescreve.
// ============================================================================

/** Cria ou reaproveita o cadastro do cliente, casando pela chave normalizada do nome. */
async function acharOuCriarCliente(nome: string): Promise<string> {
  const chave = normalizarNome(nome);
  const cadastrados = await db!
    .select({ id: schema.clientes.id, nome: schema.clientes.nome })
    .from(schema.clientes);
  const existente = cadastrados.find((c) => normalizarNome(c.nome) === chave);
  if (existente) return existente.id;
  const [novo] = await db!
    .insert(schema.clientes)
    .values({ nome })
    .returning({ id: schema.clientes.id });
  return novo.id;
}

/**
 * Confirma que a parte reconhecida é quem o advogado diz que é: grava o vínculo com
 * `origem = 'humana'` e fecha a detecção.
 *
 * Só as detecções do POLO OPOSTO do mesmo processo são descartadas junto: litisconsorte do mesmo
 * polo continua pendente, porque pode ser cliente também.
 */
export async function confirmarParteAction(
  parteDetectadaId: string,
  opcoes: { papel?: string; principal?: boolean } = {},
) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(parteDetectadaId)) return { ok: false, erro: "Identificador inválido." };

  const [det] = await db
    .select()
    .from(schema.partesDetectadas)
    .where(eq(schema.partesDetectadas.id, parteDetectadaId))
    .limit(1);
  if (!det) return { ok: false, erro: "Detecção não encontrada." };
  if (det.status !== "sugerido") return { ok: false, erro: "Esta detecção já foi decidida. Recarregue a página." };

  const papel = opcoes.papel?.trim() || det.papelSugerido || papelDoPolo(det.polo);
  const principal = opcoes.principal ?? true;
  const clienteId = await acharOuCriarCliente(det.nome);
  const agora = new Date();

  await db
    .insert(schema.processoPartes)
    .values({
      processoId: det.processoId,
      clienteId,
      papel,
      principal,
      origem: "humana",
      polo: det.polo,
      confirmadoPor: sessao.autor,
      confirmadoEm: agora,
    })
    .onConflictDoUpdate({
      target: [
        schema.processoPartes.processoId,
        schema.processoPartes.clienteId,
        schema.processoPartes.papel,
      ],
      set: {
        principal,
        origem: "humana",
        polo: det.polo,
        confirmadoPor: sessao.autor,
        confirmadoEm: agora,
      },
    });

  // O cache do nome na carteira só muda quando a parte confirmada é a principal: terceiro
  // interessado não é o cliente do processo.
  if (principal) {
    await db
      .update(schema.processos)
      .set({ clienteNome: det.nome })
      .where(eq(schema.processos.id, det.processoId));
  }

  await db
    .update(schema.partesDetectadas)
    .set({ status: "confirmado", clienteId, decididoPor: sessao.autor, decididoEm: agora })
    .where(eq(schema.partesDetectadas.id, parteDetectadaId));

  const oposto = poloOposto(det.polo);
  if (oposto) {
    await db
      .update(schema.partesDetectadas)
      .set({ status: "descartado", decididoPor: sessao.autor, decididoEm: agora })
      .where(
        and(
          eq(schema.partesDetectadas.processoId, det.processoId),
          eq(schema.partesDetectadas.polo, oposto),
          eq(schema.partesDetectadas.status, "sugerido"),
        ),
      );
  }

  revalidatePath("/", "layout");
  return { ok: true, clienteId };
}

/**
 * Descarta a detecção: esta parte não é cliente do escritório.
 *
 * Se a máquina tinha gravado o vínculo dela (o caso do polo único que saiu errado), o vínculo de
 * máquina é REMOVIDO e o cache do nome é limpo. Deixar o amarelo no lugar depois do advogado
 * dizer "não é ele" seria pior que não ter deduzido nada.
 */
export async function descartarParteAction(parteDetectadaId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(parteDetectadaId)) return { ok: false, erro: "Identificador inválido." };

  const [det] = await db
    .select()
    .from(schema.partesDetectadas)
    .where(eq(schema.partesDetectadas.id, parteDetectadaId))
    .limit(1);
  if (!det) return { ok: false, erro: "Detecção não encontrada." };
  if (det.status !== "sugerido") return { ok: false, erro: "Esta detecção já foi decidida. Recarregue a página." };

  await db
    .update(schema.partesDetectadas)
    .set({ status: "descartado", decididoPor: sessao.autor, decididoEm: new Date() })
    .where(eq(schema.partesDetectadas.id, parteDetectadaId));

  if (det.clienteId) {
    await db
      .delete(schema.processoPartes)
      .where(
        and(
          eq(schema.processoPartes.processoId, det.processoId),
          eq(schema.processoPartes.clienteId, det.clienteId),
          eq(schema.processoPartes.origem, "maquina"),
        ),
      );
    const [principalHumano] = await db.select({ id: schema.processoPartes.id }).from(schema.processoPartes)
      .where(and(eq(schema.processoPartes.processoId, det.processoId), eq(schema.processoPartes.origem, "humana"), eq(schema.processoPartes.principal, true)))
      .limit(1);
    if (!principalHumano) {
      await db.update(schema.processos).set({ clienteNome: null })
        .where(and(eq(schema.processos.id, det.processoId), eq(schema.processos.clienteNome, det.nome)));
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Confirma várias detecções de uma vez, com o papel derivado do polo de cada uma. */
export async function confirmarPartesEmLoteAction(ids: string[]) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => !ehUuid(id))) return { ok: false, erro: "Selecione até 100 identificadores válidos." };
  const alvos = [...new Set(ids)];
  if (alvos.length === 0) return { ok: false, erro: "Nada selecionado." };
  let confirmadas = 0;
  const erros: string[] = [];
  for (const id of alvos) {
    const r = await confirmarParteAction(id);
    if (r.ok) confirmadas++;
    else erros.push(r.erro ?? "falha");
  }
  revalidatePath("/", "layout");
  return { ok: confirmadas > 0, confirmadas, erros };
}

// ============================================================================
// Arquivar / excluir (soft-delete)
// ============================================================================

/** Arquiva o processo: sai da rotina de sync, continua consultável e reversível. */
export async function arquivarProcessoAction(processoId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
  await db
    .update(schema.processos)
    .set({ status: "arquivado", arquivadoEm: new Date() })
    .where(eq(schema.processos.id, processoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Desarquiva o processo, voltando ao status ativo. */
export async function desarquivarProcessoAction(processoId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
  await db
    .update(schema.processos)
    .set({ status: "ativo", arquivadoEm: null })
    .where(eq(schema.processos.id, processoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Exclui da carteira por soft-delete. O registro permanece para recuperação administrativa. */
export async function excluirProcessoAction(processoId: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(processoId)) return { ok: false, erro: "Identificador inválido." };
  await db
    .update(schema.processos)
    .set({ status: "excluido", excluidoEm: new Date() })
    .where(eq(schema.processos.id, processoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================================
// Anotações de cliente e de prazo (a de processo é adicionarAnotacaoAction)
// ============================================================================

/** Cria uma anotação livre num cliente. */
export async function adicionarAnotacaoClienteAction(clienteId: string, texto: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(clienteId)) return { ok: false, erro: "Identificador inválido." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };
  await db.insert(schema.anotacoes).values({ clienteId, texto: conteudo, autor: sessao.autor });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cria uma anotação livre num prazo. */
export async function adicionarAnotacaoPrazoAction(prazoId: string, texto: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(prazoId)) return { ok: false, erro: "Identificador inválido." };
  const conteudo = texto?.trim();
  if (!conteudo) return { ok: false, erro: "Texto obrigatório." };
  await db.insert(schema.anotacoes).values({ prazoId, texto: conteudo, autor: sessao.autor });
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const tipo = dados.tipo?.trim();
  const titulo = dados.titulo?.trim();
  if (!tipo || !titulo) return { ok: false, erro: "Tipo e título são obrigatórios." };
  if (!textoValido(tipo, 100) || !textoValido(titulo, 200) ||
      (dados.textoExtraido !== undefined && !textoValido(dados.textoExtraido, 2 * 1024 * 1024, false)) ||
      !Array.isArray(dados.tags ?? []) || (dados.tags ?? []).length > 30 ||
      (dados.tags ?? []).some((tag) => !textoValido(tag, 100))) return { ok: false, erro: "Modelo excede os limites permitidos." };
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
  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

/** Desativa (aposenta) um modelo sem apagar. */
export async function removerModeloAction(id: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(id)) return { ok: false, erro: "Identificador inválido." };
  await db.update(schema.modelosPeca).set({ ativo: false }).where(eq(schema.modelosPeca.id, id));
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const tipo = dados.tipo?.trim();
  if (!textoValido(tipo, 100)) return { ok: false, erro: "Tipo da peça inválido." };
  if ([dados.processoId, dados.prazoId, dados.clienteId].some((id) => id !== undefined && !ehUuid(id))) return { ok: false, erro: "Vínculo inválido." };
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
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(id)) return { ok: false, erro: "Identificador inválido." };
  if (!textoValido(conteudo, 2 * 1024 * 1024)) return { ok: false, erro: "Informe o texto da peça com até 2 MB." };
  await db
    .update(schema.pecas)
    .set({
      conteudo,
      status: "editado",
      origem: "humana",
      editadoPor: sessao.autor,
      editadoEm: new Date(),
      atualizadoEm: new Date(),
    })
    .where(eq(schema.pecas.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Aprova somente o texto e a versão que o advogado visualizou, sem alterar a peça. */
export async function confirmarPecaAction(
  id: string,
  revisao: { hashConteudo: string; versao: number | null; origem: string | null },
) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(id)) return { ok: false, erro: "Identificador inválido." };
  if (!revisao || !ehHashSha256(revisao.hashConteudo) || revisao.origem !== "maquina" ||
      (revisao.versao !== null && (!Number.isSafeInteger(revisao.versao) || revisao.versao < 1))) {
    return { ok: false, erro: "Recarregue a peça e confira o rascunho antes de aprovar." };
  }
  const [peca] = await db.select({ conteudo: schema.pecas.conteudo, versao: schema.pecas.versao, origem: schema.pecas.origem }).from(schema.pecas)
    .where(and(eq(schema.pecas.id, id), eq(schema.pecas.origem, "maquina"), inArray(schema.pecas.status, ["gerado", "editado"]))).limit(1);
  if (!peca?.conteudo?.trim()) return { ok: false, erro: "A peça precisa estar redigida antes da confirmação." };
  if (peca.versao !== revisao.versao || peca.origem !== revisao.origem ||
      createHash("sha256").update(peca.conteudo, "utf8").digest("hex") !== revisao.hashConteudo) {
    return { ok: false, erro: "A peça mudou desde sua leitura. Recarregue e revise o texto atualizado antes de aprovar." };
  }
  const [confirmada] = await db
    .update(schema.pecas)
    .set({ origem: "humana", editadoPor: sessao.autor, editadoEm: new Date() })
    // Compara também no UPDATE: uma geração ou edição depois da leitura acima invalida a revisão.
    .where(and(eq(schema.pecas.id, id), eq(schema.pecas.conteudo, peca.conteudo),
      peca.versao === null ? isNull(schema.pecas.versao) : eq(schema.pecas.versao, peca.versao),
      eq(schema.pecas.origem, "maquina"), inArray(schema.pecas.status, ["gerado", "editado"])))
    .returning({ id: schema.pecas.id });
  if (!confirmada) return { ok: false, erro: "A peça mudou durante a confirmação. Recarregue e revise a versão atualizada." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Arquiva uma peça (some da lista ativa). */
export async function removerPecaAction(id: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(id)) return { ok: false, erro: "Identificador inválido." };
  await db.update(schema.pecas).set({ status: "arquivado" }).where(eq(schema.pecas.id, id));
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(id)) return { ok: false, erro: "Identificador inválido." };
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
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cria um cliente novo pelo nome (para os que só existem como texto no processo). */
export async function criarClienteAction(nome: string) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  const n = nome?.trim();
  if (!n) return { ok: false, erro: "Nome é obrigatório." };
  const [row] = await db
    .insert(schema.clientes)
    .values({ nome: n })
    .returning({ id: schema.clientes.id });
  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

// ============================================================================
// Aba Inicial (caso novo). Cria a peça 'inicial' guardando os fatos como briefing
// (base para o construtor-tese), e um cliente pelo nome se ainda não existir.
// ============================================================================

export async function iniciarInicialAction(dados: { clienteNome?: string; fatos: string }) {
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
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
  revalidatePath("/", "layout");
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
  const sessao = await sessaoParaMutacao();
  if ("erro" in sessao) return { ok: false, erro: sessao.erro };
  if (!db) return { ok: false, erro: "Banco não conectado." };
  if (!ehUuid(pecaId)) return { ok: false, erro: "Identificador inválido." };
  const numeroCnj = dados.numeroCnj?.trim();
  const tribunal = dados.tribunal?.trim();
  if (!numeroCnj || !tribunal) {
    return { ok: false, erro: "Informe o número CNJ e o tribunal do processo protocolado." };
  }

  const cnjDigitos = numeroCnj.replace(/\D/g, "");
  if (cnjDigitos.length !== 20 || !textoValido(tribunal, 100)) return { ok: false, erro: "Informe um CNJ com 20 dígitos e o tribunal." };
  const [peca] = await db.select({ id: schema.pecas.id }).from(schema.pecas).where(eq(schema.pecas.id, pecaId)).limit(1);
  if (!peca) return { ok: false, erro: "Peça não encontrada." };
  const cnjFormatado = `${cnjDigitos.slice(0, 7)}-${cnjDigitos.slice(7, 9)}.${cnjDigitos.slice(9, 13)}.${cnjDigitos.slice(13, 14)}.${cnjDigitos.slice(14, 16)}.${cnjDigitos.slice(16)}`;
  const [proc] = await db
    .insert(schema.processos)
    .values({
      numeroCnj: cnjFormatado,
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
      .where(eq(schema.processos.numeroCnj, cnjFormatado))
      .limit(1);
    processoId = ex?.id;
  }
  if (!processoId) return { ok: false, erro: "Não foi possível criar o processo." };

  await db.update(schema.pecas).set({ processoId }).where(eq(schema.pecas.id, pecaId));
  revalidatePath("/", "layout");
  return { ok: true, processoId };
}
