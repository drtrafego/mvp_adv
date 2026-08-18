/**
 * Aplica em lote a classificação feita pelo squad forense: para cada intimação classificada,
 * chama o MESMO cálculo da tool `calcular_prazo` e grava o prazo como SUGERIDO, vinculado à
 * comunicação de origem.
 *
 *   pnpm tsx scripts/aplicar_prazos.ts <classificacao.json> <intimacoes.json> [--aplicar]
 *
 * Sem `--aplicar` roda em simulação: mostra a data fatal de cada uma e não grava nada.
 * A data fatal NUNCA é escrita à mão aqui: vem de calcularPrazo(), com os feriados forenses
 * do tribunal carregados. O advogado confirma no painel; nada nasce como decisão humana.
 */
import { readFileSync } from "node:fs";

// O .env do mcp-server é carregado pelo index.ts, que este script não importa. Repete aqui.
// Os imports abaixo são içados e avaliados antes deste bloco, mas db.ts só lê process.env
// dentro das funções, então basta o .env estar carregado antes da primeira chamada.
try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const linha of env.split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* sem .env: segue com o ambiente */
}

import { calcularPrazo } from "../src/lib/prazos.js";
import { buscarAto, CHAVES_ATO } from "../src/lib/catalogo-prazos.js";
import {
  inserirPrazoSugerido,
  marcarComunicacaoProcessada,
  carregarFeriadosForenses,
  bancoConfigurado,
} from "../src/lib/db.js";

interface Classificacao {
  id: string;
  gera_prazo: boolean;
  ato_chave?: string | null;
  rito?: string | null;
  dias?: number | null;
  dobro?: boolean;
  confianca?: string;
  justificativa?: string;
  trecho_fonte?: string;
  conferir?: string[];
}

interface Intimacao {
  id: string;
  tipo: string | null;
  data_disponibilizacao: string;
  numero_cnj: string | null;
  tribunal: string | null;
  processo_id: string | null;
}

const [arquivo, arquivoIntimacoes, ...flags] = process.argv.slice(2);
const aplicar = flags.includes("--aplicar");

if (!arquivo || !arquivoIntimacoes) {
  console.error(
    "uso: pnpm tsx scripts/aplicar_prazos.ts <classificacao.json> <intimacoes.json> [--aplicar]",
  );
  process.exit(1);
}
if (aplicar && !bancoConfigurado()) {
  console.error("DATABASE_URL não configurado: não dá para gravar.");
  process.exit(1);
}

const classificacoes: Classificacao[] = JSON.parse(readFileSync(arquivo, "utf8"));
const intimacoes: Intimacao[] = JSON.parse(readFileSync(arquivoIntimacoes, "utf8"));
const porId = new Map(intimacoes.map((i) => [i.id, i]));

// Cache por tribunal: a lista de feriados forenses não muda entre as intimações do mesmo foro.
const feriadosPorTribunal = new Map<string, string[]>();
async function feriados(tribunal: string | null): Promise<string[]> {
  if (!tribunal) return [];
  if (!feriadosPorTribunal.has(tribunal)) {
    feriadosPorTribunal.set(tribunal, await carregarFeriadosForenses(tribunal));
  }
  return feriadosPorTribunal.get(tribunal)!;
}

let gravados = 0;
let semPrazo = 0;
const problemas: string[] = [];

for (const c of classificacoes) {
  const i = porId.get(c.id);
  if (!i) {
    problemas.push(`${c.id}: não está no lote de intimações pendentes`);
    continue;
  }

  if (!c.gera_prazo) {
    semPrazo++;
    console.log(`- ${i.data_disponibilizacao} ${i.numero_cnj ?? "-"} :: sem prazo a praticar`);
    if (aplicar) await marcarComunicacaoProcessada(c.id);
    continue;
  }

  const chave = c.ato_chave ?? "";
  if (!CHAVES_ATO.includes(chave)) {
    problemas.push(`${c.id}: chave inexistente no catálogo -> "${chave}"`);
    continue;
  }

  const feriadosForenses = await feriados(i.tribunal);
  const r = calcularPrazo({
    dataDisponibilizacao: i.data_disponibilizacao,
    atoChave: chave,
    dias: c.dias ?? undefined,
    dobro: c.dobro ?? false,
    calendario: { feriadosForenses },
  });

  const rotulo = buscarAto(chave)?.rotulo ?? "Prazo";
  const alertas = [...r.alertas, ...(c.conferir ?? [])];
  console.log(
    `- ${i.data_disponibilizacao} ${i.numero_cnj ?? "-"} :: ${rotulo}` +
      ` -> FATAL ${r.dataFatal} (${r.diasEfetivos} dias ${r.contagem})` +
      ` [confiança ${c.confianca ?? "?"}]` +
      (alertas.length ? `\n    CONFERIR: ${alertas.join(" | ")}` : ""),
  );

  if (aplicar) {
    await inserirPrazoSugerido({
      processoId: i.processo_id,
      comunicacaoId: c.id,
      ato: rotulo,
      regraAplicada:
        [r.dispositivo, r.dobro ? "prazo em dobro" : null].filter(Boolean).join(" | ") || undefined,
      calculo: { ...r, alertas },
      justificativaIA: [c.justificativa, r.memoria.join(" ")].filter(Boolean).join(" — "),
    });
    await marcarComunicacaoProcessada(c.id);
  }
  gravados++;
}

console.log(
  `\n${aplicar ? "GRAVADOS" : "SIMULAÇÃO"}: ${gravados} prazo(s) sugerido(s), ` +
    `${semPrazo} intimação(ões) sem prazo a praticar.`,
);
if (problemas.length) {
  console.log(`\nPROBLEMAS (${problemas.length}):`);
  for (const p of problemas) console.log("  ! " + p);
}
process.exit(0);
