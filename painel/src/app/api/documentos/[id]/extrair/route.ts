import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { extractText, getDocumentProxy } from "unpdf";
import { db, schema } from "@/db";
import { getUsuarioAtual } from "@/lib/auth";
import { TEXTO_MAX, MARCA_TRUNCADO } from "@/lib/documentos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Extrai o texto do documento que já está no Blob e grava no banco.
 *
 * Separada do registro por dois motivos: o documento aparece na lista na hora, mesmo que a
 * extração demore, e dá para reprocessar quando falha. PDF digitalizado não tem camada de texto
 * e termina como `sem_texto`: aí só com OCR, que está fora do MVP.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autorizado.", { status: 401 });
  if (!db) return new Response("Banco não conectado.", { status: 503 });

  const { id } = await params;
  const [doc] = await db
    .select({
      id: schema.documentos.id,
      storagePath: schema.documentos.storagePath,
      tipo: schema.documentos.tipo,
    })
    .from(schema.documentos)
    .where(eq(schema.documentos.id, id))
    .limit(1);
  if (!doc) return new Response("Documento não encontrado.", { status: 404 });

  if (doc.tipo !== "pdf" && doc.tipo !== "texto") {
    await db
      .update(schema.documentos)
      .set({ extracaoStatus: "nao_aplica", extraidoEm: new Date() })
      .where(eq(schema.documentos.id, id));
    return Response.json({ status: "nao_aplica" });
  }

  try {
    const blob = await get(doc.storagePath, { access: "private" });
    if (!blob) return new Response("Arquivo não está mais no storage.", { status: 404 });
    const dados = new Uint8Array(await new Response(blob.stream).arrayBuffer());

    let texto = "";
    let paginas: number | null = null;
    if (doc.tipo === "pdf") {
      const pdf = await getDocumentProxy(dados);
      const r = await extractText(pdf, { mergePages: true });
      texto = String(r.text).trim();
      paginas = r.totalPages ?? null;
    } else {
      texto = Buffer.from(dados).toString("utf8").trim();
    }

    const status = texto ? "ok" : "sem_texto";
    const conteudo = texto.length > TEXTO_MAX ? texto.slice(0, TEXTO_MAX) + MARCA_TRUNCADO : texto;

    await db
      .update(schema.documentos)
      .set({
        texto: conteudo || null,
        textoExtraido: status === "ok",
        paginas,
        extracaoStatus: status,
        extraidoEm: new Date(),
      })
      .where(eq(schema.documentos.id, id));

    return Response.json({ status, paginas, caracteres: conteudo.length });
  } catch (e) {
    await db
      .update(schema.documentos)
      .set({ extracaoStatus: "falhou", extraidoEm: new Date() })
      .where(eq(schema.documentos.id, id));
    return Response.json({ status: "falhou", erro: (e as Error).message }, { status: 500 });
  }
}
