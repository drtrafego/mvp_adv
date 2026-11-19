/** Destino: painel/src/app/api/escritorio/estado/route.ts
 * Leitura de sessão; NÃO é a futura API de agentes externos.
 * Base inspecionada: drtrafego/mvp_adv e758f5c. Sem escrita ou coleta.
 */
import { getUsuarioAtual } from "@/lib/auth";
import { bancoConectado } from "@/db";
import { resumo, listarProcessos, listarPrazos, listarIntimacoes, listarPecas, saudeColeta } from "@/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  // API Routes não herdam a autorização do layout (app).
  if (!(await getUsuarioAtual())) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Sessão necessária." } }, { status: 401, headers });
  }
  if (!bancoConectado()) {
    return Response.json({ error: { code: "SOURCE_UNAVAILABLE", message: "Banco não configurado." } }, { status: 503, headers });
  }
  try {
    const [summary, processes, deadlines, notices, petitions, health] = await Promise.all([
      resumo(), listarProcessos(), listarPrazos(), listarIntimacoes({pagina:1}), listarPecas(), saudeColeta(),
    ]);
    return Response.json({
      schemaVersion: 1, mode: "live", generatedAt: new Date().toISOString(),
      source: "gabinete", attribution: ["CNJ/DataJud", "DJEN"],
      summary,
      metrics: {
        label: "Gabinete", processes: summary.totalProcessos, deadlines: summary.venceEm7Dias,
        petitions: petitions.length, petitionsIsLimited: petitions.length >= 100,
        // Valores ausentes não são zero. Não misturar a base legada de honorários com o financeiro externo.
        leads: null, contracts: null, received: null, receivable: null, series: [], funnel: [],
      },
      processes: processes.map(p=>({
        id:p.id, numeroCnj:p.numeroCnj, tribunal:p.tribunal, fase:p.fase, status:p.status,
        ultimaSincronizacao:p.ultimaSincronizacao, clienteOrigem:p.clienteOrigem,
      })),
      deadlines: deadlines.slice(0,100).map(p=>({
        id:p.id, ato:p.ato, dataFatal:p.dataFatal, dataFatalSugerida:p.dataFatalSugerida,
        status:p.status, origem:p.origem, numeroCnj:p.numeroCnj,
      })),
      notices: notices.map(n=>({
        id:n.id, tipo:n.tipo, numeroProcesso:n.numeroProcesso, numeroCnj:n.numeroCnj,
        dataDisponibilizacao:n.dataDisponibilizacao, dataPublicacao:n.dataPublicacao,
        temAnalise:n.temAnalise, temPrazo:n.temPrazo, processada:n.processada,
      })),
      health: health.map(h=>({fonte:h.fonte, status:h.status, quando:h.quando, novos:h.novos, horasAtras:h.horasAtras})),
      limits: { processes:100, notices:100, deadlines:100, petitions:100,
        processesMayBePartial:processes.length>=100, deadlinesMayBePartial:deadlines.length>100,
        noticesMayBePartial:notices.length>=100, petitionsMayBePartial:petitions.length>=100 },
      execution: { connected:false, reason:"Fila e runtime de agentes ainda não integrados." },
    }, { headers });
  } catch {
    return Response.json({ error: { code:"SOURCE_UNAVAILABLE", message:"Não foi possível ler o Gabinete." } }, { status:503, headers });
  }
}
