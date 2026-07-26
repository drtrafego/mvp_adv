import { prazosVencendo, saudeColeta, diasSemIntimacaoNova } from "@/db/queries";

export const dynamic = "force-dynamic";

/** Sem coleta há mais de 36h, ou com erro, o advogado precisa saber no mesmo dia. */
const HORAS_SEM_COLETA = 36;
/** Dias sem NENHUMA intimação nova antes de tratar como anomalia da captação. */
const DIAS_SEM_INTIMACAO = 5;

/**
 * Vigia a captação. O problema real nunca foi a coleta falhar: foi falhar em SILÊNCIO por dias,
 * gravando "ok, 0 intimações", enquanto o prazo corria. Este bloco existe para que a próxima
 * falha apareça no mesmo alerta que o advogado já lê todo dia.
 */
async function alertasDeColeta(): Promise<string[]> {
  const avisos: string[] = [];
  try {
    for (const c of await saudeColeta()) {
      const nome = c.fonte === "djen" ? "intimações (DJEN)" : "movimentações (DataJud)";
      if (!c.quando) {
        avisos.push(`⚠️ ${nome}: nenhuma coleta registrada até agora.`);
        continue;
      }
      if (c.status === "erro") {
        avisos.push(`🔴 ${nome}: a última coleta FALHOU (${c.mensagem ?? "sem detalhe"}).`);
      } else if (c.status === "parcial") {
        avisos.push(`🟠 ${nome}: última coleta parcial (${c.mensagem ?? "sem detalhe"}).`);
      }
      if ((c.horasAtras ?? 0) > HORAS_SEM_COLETA) {
        avisos.push(
          `🔴 ${nome}: sem coletar há ${c.horasAtras}h. O robô da VPS pode estar parado.`,
        );
      }
    }

    // O caso mais perigoso não é a coleta falhar: é ela rodar, dizer "ok" e não trazer nada.
    // Para um escritório ativo, vários dias sem nenhuma intimação nova é anomalia, não sorte.
    const dias = await diasSemIntimacaoNova();
    if (dias !== null && dias >= DIAS_SEM_INTIMACAO) {
      avisos.push(
        `🔴 Nenhuma intimação nova entrou há ${dias} dias, mesmo com a coleta rodando. ` +
          `Rode o diagnóstico na VPS: node scripts/diagnostico_djen.mjs 30`,
      );
    }
  } catch (e) {
    avisos.push(`⚠️ Não foi possível checar a saúde da coleta: ${(e as Error).message}`);
  }
  return avisos;
}

/**
 * Alerta de prazos, rodando como Vercel Cron (não precisa de IP do Brasil: só lê o
 * banco). Agendado no vercel.json. Se ALERTA_WEBHOOK_URL estiver definido, faz um
 * POST JSON para o canal do advogado (WhatsApp/e-mail); senão, só retorna o resumo.
 *
 * Segurança: o Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`. Se CRON_SECRET
 * estiver configurado, exigimos o header (bloqueia chamadas externas à rota).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Não autorizado.", { status: 401 });
    }
  }

  const dias = Number(process.env.ALERTA_DIAS ?? 3);
  const rows = await prazosVencendo(dias);
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  const avisosColeta = await alertasDeColeta();

  // Sem prazo à vista, o alerta ainda sai se a captação estiver doente: "nenhum prazo" só é
  // boa notícia quando a coleta está saudável.
  if (!rows.length && avisosColeta.length === 0) {
    return Response.json({ ok: true, prazos: 0, ate: limite });
  }

  const linhas = rows.map(
    (p) =>
      `• ${p.dataFatal} — ${p.ato}` +
      (p.clienteNome ? ` (${p.clienteNome})` : "") +
      (p.numeroCnj ? ` ${p.numeroCnj}` : "") +
      (p.origem === "humana" ? "" : " [a confirmar]"),
  );
  const blocoPrazos = rows.length
    ? `Gabinete: ${rows.length} prazo(s) vencem até ${limite}:\n${linhas.join("\n")}`
    : `Gabinete: nenhum prazo vencendo até ${limite}.`;
  const msg = avisosColeta.length
    ? `${blocoPrazos}\n\nSAÚDE DA COLETA:\n${avisosColeta.join("\n")}`
    : blocoPrazos;

  const webhook = process.env.ALERTA_WEBHOOK_URL;
  let enviado = false;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: msg, prazos: rows, alertasColeta: avisosColeta }),
      });
      enviado = r.ok;
    } catch {
      enviado = false;
    }
  }

  return Response.json({
    ok: true,
    prazos: rows.length,
    ate: limite,
    enviado,
    alertasColeta: avisosColeta,
  });
}
