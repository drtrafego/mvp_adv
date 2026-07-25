/** Cria prazos sugeridos para as intimações recentes (usa processos já gravados no Neon). */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db.js";
import * as schema from "../src/lib/schema.js";
import { formatarCNJ } from "../src/lib/cnj.js";
import { calcularPrazo } from "../src/lib/prazos.js";

const intimacoes: any[] = JSON.parse(
  readFileSync(new URL("../../seed_intimacoes.json", import.meta.url), "utf-8"),
);
const db = getDb();

const recentes = intimacoes
  .filter((i) => /intima/i.test(i.tipo))
  .sort((a, b) => (a.data_disp < b.data_disp ? 1 : -1))
  .slice(0, 12);

let n = 0;
for (const it of recentes) {
  const cnj = formatarCNJ(it.numero_processo);
  const [proc] = await db
    .select({ id: schema.processos.id })
    .from(schema.processos)
    .where(eq(schema.processos.numeroCnj, cnj));
  if (!proc) continue;
  // Intimação de demonstração sem ato identificado: o prazo residual da lei é de 5 dias
  // (CPC art. 218 §3º), não 15. A demo precisa nascer coerente com o motor.
  const r = calcularPrazo({
    dataDisponibilizacao: it.data_disp,
    atoChave: "manifestacao-generica",
  });
  await db.insert(schema.prazos).values({
    processoId: proc.id,
    ato: `Manifestação — ${it.orgao?.split(" DE ")[0] ?? it.sigla_tribunal}`,
    regraAplicada: `${r.dispositivo} (demo)`,
    dias: r.dias,
    contagem: r.contagem,
    dataPublicacao: r.dataPublicacao,
    dataInicio: r.dataInicioContagem,
    dataFatalSugerida: r.dataFatal,
    dataFatal: r.dataFatal,
    status: "sugerido",
    origem: "maquina",
    justificativaIa: r.memoria.join(" "),
  });
  n++;
}
console.log(`✓ ${n} prazos sugeridos criados.`);
