"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { head } from "@vercel/blob";
import { getUsuarioAtual } from "@/lib/auth";
import { ehCategoria, formatoDeExtensao, MIMES, montarStoragePath, TAMANHO_MAX_PAINEL } from "@/lib/documentos";
import { ehDataIso, ehHashSha256, ehUuid, textoValido } from "@/lib/seguranca";

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
    if (Boolean(alvo.processoId) === Boolean(alvo.pecaId) ||
        (alvo.processoId && !ehUuid(alvo.processoId)) || (alvo.pecaId && !ehUuid(alvo.pecaId)) || !ehHashSha256(hash))
      return { ok: false as const, erro: "Informe um processo ou peça válido e o hash do arquivo." };
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
  uploadId?: string;
}

/**
 * Cliente do processo por vínculo CONFIRMADO pelo advogado.
 *
 * É o único que autoriza colocar o documento na pasta do cliente: vínculo sugerido pela máquina
 * não basta, porque documento na pasta do cliente errado é vazamento, e com segredo de justiça o
 * custo é outro. NULL é preferível.
 */
async function clienteHumanoDoProcesso(processoId: string): Promise<string | null> {
  const [row] = await db!
    .select({ clienteId: schema.processoPartes.clienteId })
    .from(schema.processoPartes)
    .where(
      and(
        eq(schema.processoPartes.processoId, processoId),
        eq(schema.processoPartes.origem, "humana"),
      ),
    )
    .orderBy(desc(schema.processoPartes.principal))
    .limit(1);
  return row?.clienteId ?? null;
}

/** Registra o documento depois que o binário já subiu para o Blob. */
export async function registrarDocumentoAction(dados: DadosDocumento) {
  try {
    const usuario = await exigirUsuario();
    if (!db) return { ok: false as const, erro: "Banco não conectado." };
    if (!ehCategoria(dados.categoria))
      return { ok: false as const, erro: `Categoria inválida: ${dados.categoria}` };

    if (Boolean(dados.processoId) === Boolean(dados.pecaId) ||
        (dados.processoId && !ehUuid(dados.processoId)) || (dados.pecaId && !ehUuid(dados.pecaId)) ||
        !textoValido(dados.titulo, 200) || !textoValido(dados.arquivoNome, 255) ||
        !textoValido(dados.storagePath, 500) || !ehHashSha256(dados.hashSha256) ||
        (dados.uploadId !== undefined && !ehUuid(dados.uploadId)) ||
        !Number.isSafeInteger(dados.tamanhoBytes) || dados.tamanhoBytes <= 0 || dados.tamanhoBytes > TAMANHO_MAX_PAINEL ||
        (dados.dataDocumento && !ehDataIso(dados.dataDocumento)) ||
        (dados.descricao !== undefined && !textoValido(dados.descricao, 10_000, false))) {
      return { ok: false as const, erro: "Metadados do documento inválidos." };
    }

    let numeroCnj: string | undefined;
    if (dados.processoId) {
      const [processo] = await db.select({ numeroCnj: schema.processos.numeroCnj }).from(schema.processos)
        .where(and(eq(schema.processos.id, dados.processoId), isNull(schema.processos.excluidoEm))).limit(1);
      if (!processo) return { ok: false as const, erro: "Processo não encontrado." };
      numeroCnj = processo.numeroCnj;
    } else {
      const [peca] = await db.select({ id: schema.pecas.id }).from(schema.pecas).where(eq(schema.pecas.id, dados.pecaId!)).limit(1);
      if (!peca) return { ok: false as const, erro: "Peça não encontrada." };
    }
    const extensao = (dados.arquivoNome.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
    const dataPath = dados.storagePath.match(/\/(\d{4}-\d{2}-\d{2})-/)?.[1];
    if (!MIMES[extensao] || !ehDataIso(dataPath) || (dados.dataDocumento && dados.dataDocumento !== dataPath) ||
        dados.mimeType !== MIMES[extensao] || dados.tipo !== formatoDeExtensao(extensao)) {
      return { ok: false as const, erro: "Tipo, extensão ou data do arquivo inválidos." };
    }
    const esperado = montarStoragePath({ numeroCnj, pecaId: dados.pecaId, categoria: dados.categoria,
      titulo: dados.titulo, hashSha256: dados.hashSha256, extensao, data: dataPath, uploadId: dados.uploadId });
    if (dados.storagePath !== esperado) return { ok: false as const, erro: "O arquivo não pertence ao destino informado." };
    const existente = await verificarHashAction({ processoId: dados.processoId, pecaId: dados.pecaId }, dados.hashSha256);
    if (existente.ok && existente.existente) return { ok: true as const, id: existente.existente.id };
    const arquivo = await head(esperado);
    if (arquivo.pathname !== esperado || arquivo.size !== dados.tamanhoBytes || arquivo.contentType !== dados.mimeType) {
      return { ok: false as const, erro: "O upload não confere com os metadados informados." };
    }

    const clienteId = dados.processoId ? await clienteHumanoDoProcesso(dados.processoId) : null;

    const [row] = await db
      .insert(schema.documentos)
      .values({
        processoId: dados.processoId ?? null,
        pecaId: dados.pecaId ?? null,
        clienteId,
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
      .onConflictDoNothing()
      .returning({ id: schema.documentos.id });

    if (!row) {
      const duplicado = await verificarHashAction({ processoId: dados.processoId, pecaId: dados.pecaId }, dados.hashSha256);
      if (duplicado.ok && duplicado.existente) return { ok: true as const, id: duplicado.existente.id };
      return { ok: false as const, erro: "Não foi possível registrar o documento. Tente novamente." };
    }

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
    if (!ehUuid(documentoId) || !ehUuid(processoId)) return { ok: false as const, erro: "Identificador inválido." };
    if (patch.categoria && !ehCategoria(patch.categoria))
      return { ok: false as const, erro: "Categoria inválida." };
    if ((patch.titulo !== undefined && !textoValido(patch.titulo, 200)) ||
        (patch.descricao !== undefined && !textoValido(patch.descricao, 10_000, false)) ||
        (patch.dataDocumento && !ehDataIso(patch.dataDocumento))) return { ok: false as const, erro: "Título, descrição ou data inválidos." };
    const [atualizado] = await db
      .update(schema.documentos)
      .set({
        ...(patch.titulo ? { titulo: patch.titulo } : {}),
        ...(patch.categoria ? { categoria: patch.categoria } : {}),
        ...(patch.descricao !== undefined ? { descricao: patch.descricao || null } : {}),
        ...(patch.dataDocumento !== undefined
          ? { dataDocumento: patch.dataDocumento || null }
          : {}),
      })
      .where(and(eq(schema.documentos.id, documentoId), eq(schema.documentos.processoId, processoId), isNull(schema.documentos.excluidoEm)))
      .returning({ id: schema.documentos.id });
    if (!atualizado) return { ok: false as const, erro: "Documento não encontrado neste processo." };
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
    if (!ehUuid(documentoId) || !ehUuid(processoId)) return { ok: false as const, erro: "Identificador inválido." };
    const [excluido] = await db
      .update(schema.documentos)
      .set({ excluidoEm: new Date() })
      .where(and(eq(schema.documentos.id, documentoId), eq(schema.documentos.processoId, processoId), isNull(schema.documentos.excluidoEm)))
      .returning({ id: schema.documentos.id });
    if (!excluido) return { ok: false as const, erro: "Documento não encontrado neste processo." };
    revalidatePath(`/p/${processoId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message };
  }
}
