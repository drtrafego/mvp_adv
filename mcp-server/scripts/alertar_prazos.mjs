/**
 * Alerta de prazos que vencem em breve.
 *
 * Uso: node scripts/alertar_prazos.mjs [dias]   (padrão: 3)
 * Cron no VPS, junto da coleta (todo dia às 7h):  0 7 * * *
 *
 * Detecta os prazos NÃO cancelados cuja data fatal cai entre hoje e hoje+dias e
 * monta a mensagem. O ENVIO é plugável: se `ALERTA_WEBHOOK_URL` estiver no .env,
 * faz um POST JSON para lá (aponte para o seu canal: WhatsApp Business API, um
 * endpoint de e-mail, etc.); sem a variável, apenas imprime (o cron registra no log).
 *
 * Requer no .env: DATABASE_URL. Opcional: ALERTA_WEBHOOK_URL.
 */
import { readFileSync } from "node:fs";
import { and, gte, lte, ne, eq } from "drizzle-orm";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const l of env.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* usa o ambiente */
}

const { getDb } = await import("../dist/lib/db.js");
const schema = await import("../dist/lib/schema.js");

const dias = Number(process.argv[2] ?? 3);
const hoje = new Date().toISOString().slice(0, 10);
const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

const db = getDb();
const rows = await db
  .select({
    ato: schema.prazos.ato,
    dataFatal: schema.prazos.dataFatal,
    origem: schema.prazos.origem,
    numeroCnj: schema.processos.numeroCnj,
    clienteNome: schema.processos.clienteNome,
  })
  .from(schema.prazos)
  .leftJoin(schema.processos, eq(schema.prazos.processoId, schema.processos.id))
  .where(
    and(
      ne(schema.prazos.status, "cancelado"),
      gte(schema.prazos.dataFatal, hoje),
      lte(schema.prazos.dataFatal, limite),
    ),
  )
  .orderBy(schema.prazos.dataFatal);

if (!rows.length) {
  console.log(`Sem prazos vencendo até ${limite} (${dias} dia[s]).`);
  process.exit(0);
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
if (webhook) {
  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: msg, prazos: rows }),
    });
    console.log(`Alerta enviado ao webhook (HTTP ${r.status}).`);
  } catch (e) {
    console.error("Falha ao enviar alerta ao webhook:", e.message);
    console.log(msg);
  }
} else {
  console.log(msg);
  console.log(
    "\n(Defina ALERTA_WEBHOOK_URL no .env para enviar por WhatsApp/e-mail via o seu canal.)",
  );
}
process.exit(0);
