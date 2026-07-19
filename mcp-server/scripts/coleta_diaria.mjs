/**
 * Robô de coleta diária do Gabinete.
 *
 * Faz, numa passada:
 *  1. Movimentações de todos os processos da carteira (DataJud — funciona de qualquer IP).
 *  2. Intimações das OABs do advogado (DJEN — SÓ funciona de IP brasileiro; fora do BR dá 403).
 *  3. Auto-cadastro de processos novos que aparecerem nas intimações.
 *
 * Uso: node scripts/coleta_diaria.mjs [dias]   (padrão: 30)
 * Cron no VPS (todo dia às 7h):  0 7 * * *  cd /caminho/mcp-server && node scripts/coleta_diaria.mjs 3
 *
 * Requer no .env: DATABASE_URL e OAB_ADVOGADO (ex.: "11158/MT;43972/SC").
 */
import { readFileSync } from "node:fs";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const l of env.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { consultarProcesso } = await import("../dist/lib/datajud.js");
const { buscarIntimacoes, oabsDoAmbiente } = await import("../dist/lib/comunica.js");
const { autocadastrarDeComunicacoes } = await import("../dist/lib/auto-cadastro.js");
const { getDb, upsertMovimentacoes, upsertComunicacoes, registrarSincronizacao } = await import("../dist/lib/db.js");
const schema = await import("../dist/lib/schema.js");

const dias = Number(process.argv[2] ?? 30);
const iso = (d) => d.toISOString().slice(0, 10);
const dataFim = iso(new Date());
const dataInicio = iso(new Date(Date.now() - dias * 86400000));
const db = getDb();

console.log(`[coleta diaria] janela: ${dataInicio} a ${dataFim} (${dias} dias)\n`);

// 1. MOVIMENTACOES (DataJud) ------------------------------------------------
const procs = await db
  .select({ id: schema.processos.id, numeroCnj: schema.processos.numeroCnj })
  .from(schema.processos);
let movNovas = 0, procOk = 0;
for (const p of procs) {
  try {
    const dj = await consultarProcesso(p.numeroCnj);
    if (dj.encontrado) {
      movNovas += await upsertMovimentacoes(p.id, dj.movimentacoes);
      procOk++;
    }
  } catch { /* segue */ }
}
console.log(`[movimentacoes] ${procOk}/${procs.length} processos, ${movNovas} novas`);
await registrarSincronizacao("datajud", {
  escopo: "coleta diaria", status: "ok", itens: procs.length, novos: movNovas,
});

// 2. INTIMACOES (DJEN — precisa de IP BR) -----------------------------------
const oabs = oabsDoAmbiente();
if (oabs.length === 0) {
  console.log("[intimacoes] OAB_ADVOGADO nao configurada; pulando.");
} else {
  let intNovas = 0, criados = 0, vinculados = 0;
  let bloqueado = false;
  for (const oab of oabs) {
    try {
      const comuns = await buscarIntimacoes({
        numeroOab: String(oab.numero), ufOab: oab.uf,
        dataInicio, dataFim, oabsAlvo: oabs,
      });
      intNovas += await upsertComunicacoes(comuns);
      const r = await autocadastrarDeComunicacoes(comuns);
      criados += r.criados; vinculados += r.vinculados;
      console.log(`[intimacoes] OAB ${oab.numero}/${oab.uf}: ${comuns.length} no periodo`);
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("403") || /WAF|Forbidden|bloque/i.test(msg)) bloqueado = true;
      console.log(`[intimacoes] OAB ${oab.numero}/${oab.uf}: ERRO ${msg.slice(0, 70)}`);
    }
  }
  await registrarSincronizacao("djen", {
    escopo: "coleta diaria",
    status: bloqueado ? "erro" : "ok",
    novos: intNovas,
    mensagem: bloqueado
      ? "DJEN bloqueou (403). Rode a coleta de um IP brasileiro (VPS/maquina no Brasil)."
      : `${intNovas} novas, ${criados} processos cadastrados, ${vinculados} vinculados`,
  });
  console.log(`[intimacoes] ${intNovas} novas, ${criados} cadastrados, ${vinculados} vinculados`);
  if (bloqueado)
    console.log(`\n⚠️  DJEN bloqueou este IP (403). As intimacoes so coletam de dentro do Brasil.`);
}

console.log(`\n[coleta diaria] concluida.`);
process.exit(0);
