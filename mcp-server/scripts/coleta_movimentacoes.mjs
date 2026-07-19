// Coleta movimentacoes dos processos da carteira via DataJud (funciona de qualquer IP)
// e grava no Neon. Reporta as dos ultimos 30 dias. Idempotente (dedup no upsert).
import { readFileSync } from "node:fs";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const l of env.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { consultarProcesso } = await import("../dist/lib/datajud.js");
const { getDb, upsertMovimentacoes, registrarSincronizacao } = await import("../dist/lib/db.js");
const schema = await import("../dist/lib/schema.js");

const db = getDb();
const procs = await db
  .select({ id: schema.processos.id, numeroCnj: schema.processos.numeroCnj })
  .from(schema.processos);
console.log(`Carteira: ${procs.length} processos\n`);

const LIMITE = new Date(Date.now() - 30 * 86400000);
let ok = 0, erros = 0, totalNovas = 0, total30 = 0;

for (const p of procs) {
  try {
    const dj = await consultarProcesso(p.numeroCnj);
    if (!dj.encontrado) {
      console.log(`  ${p.numeroCnj}: sem dados no DataJud (segredo/nao sincronizado)`);
      erros++;
      continue;
    }
    const novas = await upsertMovimentacoes(p.id, dj.movimentacoes);
    const recentes30 = dj.movimentacoes.filter((m) => new Date(m.dataHora) >= LIMITE).length;
    totalNovas += novas;
    total30 += recentes30;
    ok++;
    console.log(`  ${p.numeroCnj}: ${dj.movimentacoes.length} mov (${recentes30} nos ult.30d) -> ${novas} novas gravadas`);
  } catch (e) {
    erros++;
    console.log(`  ${p.numeroCnj}: ERRO ${String(e.message).slice(0, 70)}`);
  }
}

await registrarSincronizacao("datajud", {
  escopo: "movimentacoes carteira",
  status: erros > 0 ? "parcial" : "ok",
  itens: procs.length,
  novos: totalNovas,
  mensagem: `${ok} ok, ${erros} sem dados, ${totalNovas} mov novas`,
});

console.log(`\n=== RESUMO ===`);
console.log(`Processos consultados: ${procs.length} | com dados: ${ok} | sem dados: ${erros}`);
console.log(`Movimentacoes dos ultimos 30 dias encontradas: ${total30}`);
console.log(`Movimentacoes NOVAS gravadas no banco: ${totalNovas}`);
process.exit(0);
