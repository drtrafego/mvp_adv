import { and, eq, isNull } from "drizzle-orm";
import { get } from "@vercel/blob";
import { extractText, getDocumentProxy } from "unpdf";
import { db, schema } from "@/db";
import { getUsuarioAtual } from "@/lib/auth";
import { TEXTO_MAX, MARCA_TRUNCADO } from "@/lib/documentos";
import { ehUuid, origemPermitida } from "@/lib/seguranca";
import { lerBytesLimitados } from "@/lib/leitura-stream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Extrai o texto do documento que já está no Blob e grava no banco.
 *
 * Separada do registro por dois motivos: o documento aparece na lista na hora, mesmo que a
 * extração demore, e dá para reprocessar quando falha. PDF digitalizado não tem camada de texto
 * e termina como `sem_texto`: aí só com OCR, que está fora do MVP.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!origemPermitida(req)) return new Response("Origem não autorizada.", { status: 403 });
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autorizado.", { status: 401 });
  if (!db) return new Response("Banco não conectado.", { status: 503 });

  const { id } = await params;
  if (!ehUuid(id)) return new Response("Documento não encontrado.", { status: 404 });
  const [doc] = await db
    .select({
      id: schema.documentos.id,
      storagePath: schema.documentos.storagePath,
      tipo: schema.documentos.tipo,
      tamanhoBytes: schema.documentos.tamanhoBytes,
    })
    .from(schema.documentos)
    .where(and(eq(schema.documentos.id, id), isNull(schema.documentos.excluidoEm)))
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
    if (!blob?.stream) return new Response("Arquivo não está mais no storage.", { status: 404 });
    // Evita carregar autos de centenas de MB na função serverless. O original continua disponível.
    const limiteExtracao = 25 * 1024 * 1024;
    const tamanhoReal = Number(blob.headers.get("content-length") ?? doc.tamanhoBytes ?? 0);
    if (!Number.isFinite(tamanhoReal) || tamanhoReal <= 0 || tamanhoReal > limiteExtracao) {
      await db.update(schema.documentos).set({ extracaoStatus: "falhou", extraidoEm: new Date() }).where(eq(schema.documentos.id, id));
      return Response.json({ status: "falhou", erro: "Extração automática limitada a 25 MB. Use a leitura do original ou o processamento no servidor." }, { status: 413 });
    }
    const dados = await lerBytesLimitados(blob.stream, limiteExtracao);

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
  } catch {
    await db
      .update(schema.documentos)
      .set({ extracaoStatus: "falhou", extraidoEm: new Date() })
      .where(eq(schema.documentos.id, id));
    return Response.json({ status: "falhou", erro: "Não foi possível extrair o texto. Confira o arquivo original e tente novamente." }, { status: 500 });
  }
}
