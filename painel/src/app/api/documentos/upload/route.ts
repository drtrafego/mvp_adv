import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getUsuarioAtual } from "@/lib/auth";
import { db, schema } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { ehDataIso, ehHashSha256, ehUuid, origemPermitida, textoValido } from "@/lib/seguranca";
import {
  ehCategoria,
  MIMES,
  TAMANHO_MAX_PAINEL,
  montarStoragePath,
} from "@/lib/documentos";

export const dynamic = "force-dynamic";

/**
 * Handshake do upload de documento.
 *
 * O arquivo NÃO passa por aqui: uma função serverless tem teto de corpo de requisição (4,5 MB) e
 * autos passam disso com facilidade. Esta rota só valida e devolve um token curto; o browser
 * envia os bytes direto para o Blob.
 *
 * Toda a validação de verdade acontece deste lado: o cliente pode mentir sobre o pathname, o
 * tamanho e o tipo, então nada do que ele manda é aceito sem conferência.
 */
export async function POST(request: Request): Promise<Response> {
  if (!db) return new Response("Banco não conectado.", { status: 503 });
  try {
    const body = (await request.json()) as HandleUploadBody;
    // O SDK autentica a assinatura do callback Blob. Apenas a emissão de token usa cookie.
    if (body.type === "blob.generate-client-token") {
      if (!origemPermitida(request)) return new Response("Origem não autorizada.", { status: 403 });
      if (!(await getUsuarioAtual())) return new Response("Não autorizado.", { status: 401 });
    }
    const resultado = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const p = JSON.parse(clientPayload ?? "{}") as {
          processoId?: string;
          pecaId?: string;
          categoria?: string;
          titulo?: string;
          hash?: string;
          dataDocumento?: string;
          uploadId?: string;
        };
        if (Boolean(p.processoId) === Boolean(p.pecaId) ||
            (p.processoId && !ehUuid(p.processoId)) || (p.pecaId && !ehUuid(p.pecaId)) ||
            !p.categoria || !ehHashSha256(p.hash) || !textoValido(p.titulo, 200) ||
            (p.uploadId !== undefined && !ehUuid(p.uploadId)) ||
            (p.dataDocumento && !ehDataIso(p.dataDocumento))) {
          throw new Error("Dados do upload incompletos.");
        }
        if (!ehCategoria(p.categoria)) throw new Error(`Categoria inválida: ${p.categoria}`);

        // O alvo é o processo (caso em curso) ou a peça (caso novo, ainda sem CNJ). Nos dois,
        // confere-se que existe antes de liberar escrita no storage.
        let numeroCnj: string | undefined;
        if (p.processoId) {
          const [processo] = await db!
            .select({ id: schema.processos.id, numeroCnj: schema.processos.numeroCnj })
            .from(schema.processos)
            .where(and(eq(schema.processos.id, p.processoId), isNull(schema.processos.excluidoEm)))
            .limit(1);
          if (!processo) throw new Error("Processo não encontrado.");
          numeroCnj = processo.numeroCnj;
        } else {
          const [peca] = await db!
            .select({ id: schema.pecas.id })
            .from(schema.pecas)
            .where(eq(schema.pecas.id, p.pecaId as string))
            .limit(1);
          if (!peca) throw new Error("Peça não encontrada.");
        }

        // O caminho é derivado no servidor e comparado com o pedido: sem isso o cliente
        // escolheria onde gravar dentro do store.
        const extensao = (pathname.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
        if (!MIMES[extensao]) throw new Error("Extensão de arquivo não permitida.");
        const esperado = montarStoragePath({
          numeroCnj,
          pecaId: p.pecaId,
          categoria: p.categoria,
          titulo: p.titulo,
          hashSha256: p.hash,
          extensao,
          data: p.dataDocumento || undefined,
          uploadId: p.uploadId,
        });
        if (pathname !== esperado) {
          throw new Error("Caminho do arquivo não confere com a convenção do sistema.");
        }

        return {
          allowedContentTypes: [MIMES[extensao]],
          maximumSizeInBytes: TAMANHO_MAX_PAINEL,
          addRandomSuffix: false,
          allowOverwrite: false,
          // O registro no banco é feito pela Server Action, depois que o upload conclui.
          tokenPayload: JSON.stringify({ processoId: p.processoId, pecaId: p.pecaId }),
        };
      },
      onUploadCompleted: async () => {
        // Webhook não funciona em localhost sem túnel; o registro é feito pela action
        // registrarDocumentoAction, que é também quem decide a pasta do cliente (só com vínculo
        // `origem = 'humana'`). Aqui nada é gravado no banco.
      },
    });
    return Response.json(resultado);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
