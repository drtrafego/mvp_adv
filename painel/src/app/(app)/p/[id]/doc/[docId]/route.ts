import { and, eq, isNull } from "drizzle-orm";
import { get } from "@vercel/blob";
import { db, schema } from "@/db";
import { getUsuarioAtual } from "@/lib/auth";
import { ehUuid, nomeDownload } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/**
 * Download do documento.
 *
 * A URL do Blob nunca chega ao HTML: o arquivo pode estar em segredo de justiça, e URL vazada
 * seria acesso perpétuo. O painel só conhece o id; o binário é servido por aqui, com sessão
 * conferida e depois de verificar que o documento pertence mesmo àquele processo.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autorizado.", { status: 401 });
  if (!db) return new Response("Banco não conectado.", { status: 503 });

  const { id: processoId, docId } = await params;
  if (!ehUuid(processoId) || !ehUuid(docId)) return new Response("Documento não encontrado.", { status: 404 });
  const [doc] = await db
    .select({
      storagePath: schema.documentos.storagePath,
      arquivoNome: schema.documentos.arquivoNome,
      mimeType: schema.documentos.mimeType,
    })
    .from(schema.documentos)
    .innerJoin(schema.processos, eq(schema.documentos.processoId, schema.processos.id))
    .where(
      and(
        eq(schema.documentos.id, docId),
        eq(schema.documentos.processoId, processoId),
        isNull(schema.documentos.excluidoEm),
        isNull(schema.processos.excluidoEm),
      ),
    )
    .limit(1);

  if (!doc) return new Response("Documento não encontrado.", { status: 404 });

  try {
    const blob = await get(doc.storagePath, { access: "private" });
    if (!blob) return new Response("Arquivo não está mais no storage.", { status: 404 });
    const { stream, headers } = blob;
    const nome = nomeDownload(doc.arquivoNome);
    const nomeAscii = nome.replace(/[^\x20-\x7e]/g, "_");
    return new Response(stream, {
      headers: {
        "Content-Type": doc.mimeType ?? headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(nome).replace(/'/g, "%27")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Falha ao abrir o arquivo. Tente novamente.", { status: 502 });
  }
}
