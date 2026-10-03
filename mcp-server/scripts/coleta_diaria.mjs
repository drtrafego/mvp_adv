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
import { and, eq, isNull } from "drizzle-orm";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const l of env.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { consultarProcesso } = await import("../dist/lib/datajud.js");
const { buscarIntimacoes, ComunicaError, oabsDoAmbiente } = await import("../dist/lib/comunica.js");
const { hojeEscritorio, diasOperacionais, deslocarData } = await import("../dist/lib/tempo.js");
const { autocadastrarDeComunicacoes } = await import("../dist/lib/auto-cadastro.js");
const { getDb, upsertMovimentacoes, upsertComunicacoes, registrarSincronizacao } = await import("../dist/lib/db.js");
const schema = await import("../dist/lib/schema.js");

const dias = diasOperacionais(process.argv[2] ?? 30);
const dataFim = hojeEscritorio();
const dataInicio = deslocarData(dataFim, -dias);
const db = getDb();

console.log(`[coleta diaria] janela: ${dataInicio} a ${dataFim} (${dias} dias)\n`);

// 1. MOVIMENTACOES (DataJud) ------------------------------------------------
const procs = await db
  .select({ id: schema.processos.id, numeroCnj: schema.processos.numeroCnj })
  .from(schema.processos)
  .where(and(eq(schema.processos.status, "ativo"), isNull(schema.processos.excluidoEm)));
let movNovas = 0, procOk = 0;
const falhasMov = [];
for (const p of procs) {
  try {
    const dj = await consultarProcesso(p.numeroCnj);
    if (dj.encontrado) {
      movNovas += await upsertMovimentacoes(p.id, dj.movimentacoes);
      procOk++;
    } else {
      falhasMov.push(`${p.numeroCnj}: sem dados no DataJud`);
    }
  } catch (e) {
    falhasMov.push(`${p.numeroCnj}: ${String(e.message || e).slice(0, 120)}`);
  }
}
console.log(`[movimentacoes] ${procOk}/${procs.length} processos, ${movNovas} novas`);
await registrarSincronizacao("datajud", {
  escopo: "coleta diaria",
  status: falhasMov.length ? (procOk ? "parcial" : "erro") : "ok",
  itens: procOk, novos: movNovas,
  mensagem: falhasMov.length ? falhasMov.join(" | ").slice(0, 1500) : `${procOk} processos consultados`,
});
if (falhasMov.length) console.error(`[movimentacoes] ${falhasMov.join(" | ")}`);
let coletaFalhou = falhasMov.length > 0;

// 2. INTIMACOES (DJEN — precisa de IP BR) -----------------------------------
const oabs = oabsDoAmbiente();
if (oabs.length === 0) {
  console.error("[intimacoes] OAB_ADVOGADO ausente/invalida; coleta nao executada.");
  await registrarSincronizacao("djen", { escopo: "coleta diaria", status: "erro", mensagem: "OAB_ADVOGADO ausente ou invalida" });
  coletaFalhou = true;
} else {
  let intEncontradas = 0, intNovas = 0, criados = 0, vinculados = 0;
  let bloqueado = false;
  const falhas = [];
  for (const oab of oabs) {
    try {
      const comuns = await buscarIntimacoes({
        numeroOab: String(oab.numero), ufOab: oab.uf, letraOab: oab.letra,
        dataInicio, dataFim, oabsAlvo: oabs,
      });
      intEncontradas += comuns.length;
      intNovas += await upsertComunicacoes(comuns);
      const r = await autocadastrarDeComunicacoes(comuns);
      criados += r.criados; vinculados += r.vinculados;
      console.log(`[intimacoes] OAB ${oab.numero}/${oab.uf}: ${comuns.length} no periodo`);
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("403") || /WAF|Forbidden|bloque/i.test(msg)) bloqueado = true;
      // Qualquer falha entra no registro. Antes, erro que não fosse 403 era engolido e a coleta
      // gravava "ok, 0 novas" — indistinguível de "não havia intimação nenhuma".
      falhas.push(`${oab.numero}/${oab.uf}: ${msg.slice(0, 90)}`);
      // Preserve o que já veio, mas não classifique clientes a partir de cobertura incompleta.
      if (e instanceof ComunicaError && e.itensParciais.length) {
        intEncontradas += e.itensParciais.length;
        intNovas += await upsertComunicacoes(e.itensParciais);
      }
      console.log(`[intimacoes] OAB ${oab.numero}/${oab.uf}: ERRO ${msg.slice(0, 70)}`);
    }
  }
  const houveSucesso = falhas.length < oabs.length || intEncontradas > 0;
  await registrarSincronizacao("djen", {
    escopo: "coleta diaria",
    status: !houveSucesso ? "erro" : falhas.length > 0 ? "parcial" : "ok",
    // itens = quantas o DJEN devolveu no período; novos = quantas eram inéditas no banco.
    // Sem separar as duas, "0 novas" some com a diferença entre "nada publicado" e "tudo repetido".
    itens: intEncontradas,
    novos: intNovas,
    mensagem: bloqueado
      ? "DJEN bloqueou (403). Rode a coleta de um IP brasileiro (VPS/maquina no Brasil)."
      : falhas.length > 0
        ? `falha em ${falhas.length} de ${oabs.length} OAB(s): ${falhas.join(" | ")}`
        : `${intEncontradas} no periodo, ${intNovas} novas, ${criados} processos cadastrados, ${vinculados} vinculados`,
  });
  console.log(`[intimacoes] ${intNovas} novas, ${criados} cadastrados, ${vinculados} vinculados`);
  if (bloqueado)
    console.log(`\n⚠️  DJEN bloqueou este IP (403). As intimacoes so coletam de dentro do Brasil.`);
  coletaFalhou ||= falhas.length > 0;
}

console.log(`\n[coleta diaria] concluida.`);
process.exit(coletaFalhou ? 1 : 0);
