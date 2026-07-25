/**
 * Seed de demonstração: popula o Neon com os processos e intimações REAIS do Daniel.
 * Intimações vêm do arquivo seed_intimacoes.json (puxado do VPS brasileiro).
 * Capa de cada processo vem do DataJud (que não bloqueia a Argentina).
 * Prazos são calculados pelo motor determinístico. Roda com DATABASE_URL setado.
 */
import { readFileSync } from "node:fs";
import { getDb } from "../src/lib/db.js";
import * as schema from "../src/lib/schema.js";
import { consultarProcesso } from "../src/lib/datajud.js";
import { limparCNJ, formatarCNJ, validarCNJ } from "../src/lib/cnj.js";
import { calcularPrazo } from "../src/lib/prazos.js";

interface Intim {
  hash: string;
  numero_processo: string;
  sigla_tribunal: string;
  tipo: string;
  data_disp: string;
  orgao: string;
  texto: string;
  oab: string;
}

const raw = readFileSync(new URL("../../seed_intimacoes.json", import.meta.url), "utf-8");
const intimacoes: Intim[] = JSON.parse(raw);
const db = getDb();

function extrairCliente(texto: string): string | null {
  const m = texto.match(
    /(?:Exequente|Autor|Embargante|Requerente|Agravante|Impetrante|Reclamante)\s*:?\s*([A-ZÀ-Ú][A-Za-zÀ-ú .&-]{3,55})/,
  );
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

// agrupa intimações por processo
const porProcesso = new Map<string, Intim[]>();
for (const it of intimacoes) {
  const cnj = limparCNJ(it.numero_processo);
  if (cnj.length !== 20) continue;
  if (!porProcesso.has(cnj)) porProcesso.set(cnj, []);
  porProcesso.get(cnj)!.push(it);
}

console.log(`Processos únicos: ${porProcesso.size} | intimações: ${intimacoes.length}`);

let nProc = 0,
  nMov = 0,
  nCom = 0,
  nPrazo = 0;

for (const [cnj, its] of porProcesso) {
  const primeira = its[0];
  const clienteNome = its.map((i) => extrairCliente(i.texto)).find(Boolean) ?? null;

  // 1. capa no DataJud
  let capa;
  try {
    capa = await consultarProcesso(cnj);
  } catch (e) {
    console.log(`  ! ${formatarCNJ(cnj)}: DataJud falhou (${(e as Error).message.slice(0, 40)})`);
    capa = null;
  }

  // 2. grava processo
  const [proc] = await db
    .insert(schema.processos)
    .values({
      numeroCnj: formatarCNJ(cnj),
      tribunal: capa?.tribunal ?? primeira.sigla_tribunal ?? "?",
      classe: capa?.classe ?? null,
      assunto: capa?.assunto ?? null,
      orgaoJulgador: capa?.orgaoJulgador ?? primeira.orgao ?? null,
      grau: capa?.grau ?? null,
      clienteNome,
      status: "ativo",
      ultimaSincronizacao: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.processos.numeroCnj,
      set: { ultimaSincronizacao: new Date(), clienteNome },
    })
    .returning({ id: schema.processos.id });
  const processoId = proc.id;
  nProc++;

  // 3. movimentações do DataJud
  if (capa?.movimentacoes?.length) {
    const linhas = capa.movimentacoes.slice(0, 30).map((m) => ({
      processoId,
      codigoCnj: m.codigo,
      descricao: m.descricao,
      dataHora: new Date(m.dataHora),
      fonte: "datajud",
    }));
    const ins = await db
      .insert(schema.movimentacoes)
      .values(linhas)
      .onConflictDoNothing()
      .returning({ id: schema.movimentacoes.id });
    nMov += ins.length;
  }

  // 4. comunicações (intimações) vinculadas
  for (const it of its) {
    const ins = await db
      .insert(schema.comunicacoes)
      .values({
        processoId,
        hashDjen: it.hash,
        numeroProcesso: formatarCNJ(cnj),
        tipo: it.tipo,
        meio: "DJEN",
        inteiroTeor: it.texto,
        dataDisponibilizacao: it.data_disp,
        oabDestino: it.oab,
        processada: false,
      })
      .onConflictDoNothing()
      .returning({ id: schema.comunicacoes.id });
    if (ins.length) nCom++;
  }
}

// 5. prazos: para as ~10 intimações mais recentes que são "Intimação". Sem ato identificado, o
// prazo da lei é o residual de 5 dias (CPC art. 218 §3º), nunca 15.
const recentes = [...intimacoes]
  .filter((i) => /intima/i.test(i.tipo))
  .sort((a, b) => (a.data_disp < b.data_disp ? 1 : -1))
  .slice(0, 10);

for (const it of recentes) {
  const cnj = formatarCNJ(it.numero_processo);
  const [proc] = await db
    .select({ id: schema.processos.id })
    .from(schema.processos)
    .where(eqNumero(cnj));
  if (!proc) continue;
  const r = calcularPrazo({
    dataDisponibilizacao: it.data_disp,
    atoChave: "manifestacao-generica",
  });
  await db.insert(schema.prazos).values({
    processoId: proc.id,
    ato: "Manifestação (prazo residual da lei)",
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
  nPrazo++;
}

console.log(
  `\n✓ Seed concluído: ${nProc} processos, ${nMov} movimentações, ${nCom} intimações, ${nPrazo} prazos sugeridos.`,
);

// helper de igualdade de número (import tardio evita ciclo)
import { eq } from "drizzle-orm";
function eqNumero(numero: string) {
  return eq(schema.processos.numeroCnj, numero);
}
