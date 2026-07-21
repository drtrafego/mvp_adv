import { prazosVencendo } from "@/db/queries";

export const dynamic = "force-dynamic";

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

  if (!rows.length) {
    return Response.json({ ok: true, prazos: 0, ate: limite });
  }

  const linhas = rows.map(
    (p) =>
      `• ${p.dataFatal} — ${p.ato}` +
      (p.clienteNome ? ` (${p.clienteNome})` : "") +
      (p.numeroCnj ? ` ${p.numeroCnj}` : "") +
      (p.origem === "humana" ? "" : " [a confirmar]"),
  );
  const msg = `Gabinete: ${rows.length} prazo(s) vencem até ${limite}:\n${linhas.join("\n")}`;

  const webhook = process.env.ALERTA_WEBHOOK_URL;
  let enviado = false;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: msg, prazos: rows }),
      });
      enviado = r.ok;
    } catch {
      enviado = false;
    }
  }

  return Response.json({ ok: true, prazos: rows.length, ate: limite, enviado });
}
