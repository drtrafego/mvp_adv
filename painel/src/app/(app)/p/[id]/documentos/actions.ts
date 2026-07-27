"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUsuarioAtual } from "@/lib/auth";
import { ehCategoria } from "@/lib/documentos";

/**
 * Server Action é um endpoint HTTP de id estável: sem checagem de sessão, quem descobrir o id
 * invoca sem cookie. Documento de processo pode estar em segredo de justiça, então toda action
 * daqui começa por esta função.
 */
async function exigirUsuario() {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autorizado.");
  return usuario;
}

/**
 * O mesmo arquivo não entra duas vezes no mesmo lugar. Checado antes de gastar o upload.
 * O alvo é o processo (caso em curso) ou a peça (caso novo, ainda sem CNJ).
 */
export async function verificarHashAction(
  alvo: { processoId?: string; pecaId?: string },
  hash: string,
) {
  try {
    await exigirUsuario();
    if (!db) return { ok: false as const, erro: "Banco não conectado." };
    if (!alvo.processoId && !alvo.pecaId)
      return { ok: false as const, erro: "Informe o processo ou a peça." };
    const [existente] = await db
      .select({
        id: schema.documentos.id,
        titulo: schema.documentos.titulo,
        categoria: schema.documentos.categoria,
        createdAt: schema.documentos.createdAt,
      })
      .from(schema.documentos)
      .where(
        and(
          alvo.processoId
            ? eq(schema.documentos.processoId, alvo.processoId)
            : eq(schema.documentos.pecaId, alvo.pecaId as string),
          eq(schema.documentos.hashSha256, hash),
          isNull(schema.documentos.excluidoEm),
        ),
      )
      .limit(1);
    return { ok: true as const, existente: existente ?? null };
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message };
  }
}

export interface DadosDocumento {
  /** Um dos dois: processo (caso em curso) ou peça (caso novo, ainda sem CNJ). */
  processoId?: string;
  pecaId?: string;
  titulo: string;
  categoria: string;
  storagePath: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
  hashSha256: string;
  tipo: string;
  descricao?: string;
  dataDocumento?: string;
}

/** Registra o documento depois que o binário já subiu para o Blob. */
export async function registrarDocumentoAction(dados: DadosDocumento) {
  try {
    const usuario = await exigirUsuario();
    if (!db) return { ok: false as const, erro: "Banco não conectado." };
    if (!ehCategoria(dados.categoria))
      return { ok: false as const, erro: `Categoria inválida: ${dados.categoria}` };

    const [row] = await db
      .insert(schema.documentos)
      .values({
        processoId: dados.processoId ?? null,
        pecaId: dados.pecaId ?? null,
        titulo: dados.titulo,
        tipo: dados.tipo,
        categoria: dados.categoria,
        storagePath: dados.storagePath,
        arquivoNome: dados.arquivoNome,
        mimeType: dados.mimeType,
        tamanhoBytes: dados.tamanhoBytes,
        hashSha256: dados.hashSha256,
        extracaoStatus: "pendente",
        fonte: "upload_painel",
        enviadoPor: `painel:${usuario.email ?? usuario.id}`,
        descricao: dados.descricao?.trim() || null,
        dataDocumento: dados.dataDocumento || null,
      })
      .returning({ id: schema.documentos.id });

    revalidatePath(dados.processoId ? `/p/${dados.processoId}` : `/pe/${dados.pecaId}`);
    return { ok: true as const, id: row.id };
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message };
  }
}

export async function atualizarDocumentoAction(
  documentoId: string,
  processoId: string,
  patch: { titulo?: string; categoria?: string; descricao?: string; dataDocumento?: string },
) {
  try {
    await exigirUsuario();
    if (!db) return { ok: false as const, erro: "Banco não conectado." };
    if (patch.categoria && !ehCategoria(patch.categoria))
      return { ok: false as const, erro: "Categoria inválida." };
    await db
      .update(schema.documentos)
      .set({
        ...(patch.titulo ? { titulo: patch.titulo } : {}),
        ...(patch.categoria ? { categoria: patch.categoria } : {}),
        ...(patch.descricao !== undefined ? { descricao: patch.descricao || null } : {}),
        ...(patch.dataDocumento !== undefined
          ? { dataDocumento: patch.dataDocumento || null }
          : {}),
      })
      .where(eq(schema.documentos.id, documentoId));
    revalidatePath(`/p/${processoId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message };
  }
}

/** Soft delete: some da lista, mas o binário e o registro ficam, como nos processos. */
export async function excluirDocumentoAction(documentoId: string, processoId: string) {
  try {
    await exigirUsuario();
    if (!db) return { ok: false as const, erro: "Banco não conectado." };
    await db
      .update(schema.documentos)
      .set({ excluidoEm: new Date() })
      .where(eq(schema.documentos.id, documentoId));
    revalidatePath(`/p/${processoId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message };
  }
}
