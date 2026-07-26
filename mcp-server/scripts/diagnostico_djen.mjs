/**
 * Diagnóstico da coleta de intimações. RODAR NA VPS (ou em qualquer máquina no Brasil):
 * o DJEN recusa conexão de fora do país.
 *
 *   node scripts/diagnostico_djen.mjs [dias]     (padrão: 30)
 *
 * Responde a pergunta que o registro de sincronização não respondia: quando a coleta diz
 * "0 novas", é porque o DJEN devolveu nada, ou porque o filtro por OAB descartou tudo?
 * Ele consulta duas vezes, COM e SEM o filtro, e compara.
 */
import { readFileSync } from "node:fs";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const l of env.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { buscarIntimacoes, oabsDoAmbiente } = await import("../dist/lib/comunica.js");
const { userDataDir } = await import("../dist/lib/comunica-browser.js");

/**
 * Checagem de ambiente. A coleta manual funcionou e a automática nunca: quando isso acontece, a
 * diferença costuma estar no ambiente do cron (sem HOME, sem navegador instalado, perfil noutro
 * caminho), não na lógica. Então o diagnóstico começa mostrando o ambiente real.
 */
async function ambiente() {
  const { existsSync, readdirSync } = await import("node:fs");
  console.log("--- ambiente ---");
  console.log(`  cwd:      ${process.cwd()}`);
  console.log(`  HOME:     ${process.env.HOME ?? "(não definido: típico de cron)"}`);
  const perfil = userDataDir();
  const temPerfil = existsSync(perfil);
  console.log(`  perfil do navegador: ${perfil}`);
  console.log(
    `    ${temPerfil ? "existe" : "NÃO EXISTE (cada execução recomeça o desafio do WAF)"}`,
  );
  try {
    const { chromium } = await import("playwright");
    const exe = chromium.executablePath();
    console.log(`  chromium: ${exe}`);
    console.log(`    ${existsSync(exe) ? "instalado" : "NÃO INSTALADO -> npx playwright install chromium"}`);
  } catch (e) {
    console.log(`  chromium: falha ao localizar (${String(e.message).slice(0, 80)})`);
  }
  console.log();
}
await ambiente();

const dias = Number(process.argv[2] ?? 30);
const iso = (d) => d.toISOString().slice(0, 10);
const dataFim = iso(new Date());
const dataInicio = iso(new Date(Date.now() - dias * 86400000));

const oabs = oabsDoAmbiente();
console.log(`Janela: ${dataInicio} a ${dataFim} (${dias} dias)`);
console.log(`OAB_ADVOGADO: ${oabs.map((o) => `${o.numero}/${o.uf}`).join("; ") || "(não configurada)"}\n`);

if (oabs.length === 0) {
  console.log("Sem OAB_ADVOGADO no .env: nada a consultar.");
  process.exit(1);
}

for (const oab of oabs) {
  const escopo = `OAB ${oab.numero}/${oab.uf}`;
  console.log(`=== ${escopo} ===`);

  // 1) Sem filtro: o que o DJEN devolve de fato para essa OAB.
  let semFiltro = [];
  try {
    semFiltro = await buscarIntimacoes({
      numeroOab: String(oab.numero),
      ufOab: oab.uf,
      dataInicio,
      dataFim,
    });
    console.log(`  DJEN devolveu (sem filtro): ${semFiltro.length}`);
  } catch (e) {
    console.log(`  ERRO na consulta: ${String(e.message).slice(0, 160)}`);
    if (e.bloqueadoPorWAF) console.log("  -> bloqueio de IP/WAF: precisa rodar de dentro do Brasil.");
    continue;
  }

  // 2) Com o filtro que a coleta diária usa.
  const comFiltro = await buscarIntimacoes({
    numeroOab: String(oab.numero),
    ufOab: oab.uf,
    dataInicio,
    dataFim,
    oabsAlvo: oabs,
  });
  console.log(`  Depois do filtro por OAB:  ${comFiltro.length}`);

  if (semFiltro.length > 0 && comFiltro.length === 0) {
    console.log("  >>> CAUSA ENCONTRADA: o DJEN devolve, mas o filtro por OAB descarta tudo.");
    const amostra = semFiltro.slice(0, 3);
    for (const c of amostra) {
      const advs = c.advogados.map((a) => `${a.nome ?? "?"} (${a.oab ?? "sem oab"})`).join(" | ");
      console.log(`      ${c.dataDisponibilizacao} ${c.numeroProcesso ?? "-"} advogados: ${advs || "(nenhum)"}`);
    }
  } else if (semFiltro.length === 0) {
    console.log("  >>> O DJEN não devolveu nada no período. Não é filtro: é ausência de publicação.");
  } else {
    console.log("  >>> Coleta saudável: o filtro manteve as comunicações do advogado.");
    const porData = new Map();
    for (const c of comFiltro) porData.set(c.dataDisponibilizacao, (porData.get(c.dataDisponibilizacao) ?? 0) + 1);
    console.log(
      "      por data: " +
        [...porData.entries()].sort().map(([d, n]) => `${d}:${n}`).join("  "),
    );
  }
  console.log();
}
