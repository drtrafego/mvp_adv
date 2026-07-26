import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getUsuarioAtual } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
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
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autorizado.", { status: 401 });
  if (!db) return new Response("Banco não conectado.", { status: 503 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const resultado = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const p = JSON.parse(clientPayload ?? "{}") as {
          processoId?: string;
          categoria?: string;
          titulo?: string;
          hash?: string;
        };
        if (!p.processoId || !p.categoria || !p.hash || !p.titulo) {
          throw new Error("Dados do upload incompletos.");
        }
        if (!ehCategoria(p.categoria)) throw new Error(`Categoria inválida: ${p.categoria}`);

        const [processo] = await db!
          .select({ id: schema.processos.id, numeroCnj: schema.processos.numeroCnj })
          .from(schema.processos)
          .where(eq(schema.processos.id, p.processoId))
          .limit(1);
        if (!processo) throw new Error("Processo não encontrado.");

        // O caminho é derivado no servidor e comparado com o pedido: sem isso o cliente
        // escolheria onde gravar dentro do store.
        const extensao = (pathname.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
        const esperado = montarStoragePath({
          numeroCnj: processo.numeroCnj,
          categoria: p.categoria,
          titulo: p.titulo,
          hashSha256: p.hash,
          extensao,
        });
        if (pathname !== esperado) {
          throw new Error("Caminho do arquivo não confere com a convenção do sistema.");
        }

        return {
          allowedContentTypes: Object.values(MIMES),
          maximumSizeInBytes: TAMANHO_MAX_PAINEL,
          addRandomSuffix: false,
          allowOverwrite: true,
          // O registro no banco é feito pela Server Action, depois que o upload conclui.
          tokenPayload: JSON.stringify({ processoId: p.processoId }),
        };
      },
      onUploadCompleted: async () => {
        // Webhook não funciona em localhost sem túnel; o registro é feito pela action.
      },
    });
    return Response.json(resultado);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
