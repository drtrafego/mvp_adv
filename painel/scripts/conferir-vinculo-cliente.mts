/**
 * Confere a saude do vinculo processo <-> cliente. So LE e reporta, nao grava nada.
 *
 *   pnpm conferir-vinculo
 *
 * Tres divergencias interessam:
 *  1. processo com `cliente_nome` preenchido e SEM linha em `processo_partes` (vinculo so por
 *     nome, o caminho legado que a pasta do cliente ainda precisa cobrir por fallback);
 *  2. processo com vinculo relacional cujo `cliente_nome` nao bate com o nome do cliente
 *     vinculado (cache desencontrado);
 *  3. cliente duplicado por `nome_chave` (o mesmo nome cadastrado duas vezes, com acento ou
 *     sufixo societario diferente).
 *
 * Le DATABASE_URL do painel/.env.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { normalizarNome } from "../src/lib/partes.ts";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const linha of env.split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* sem .env, usa o ambiente */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL nao definido (painel/.env)");
  process.exit(1);
}

const sql = neon(url);

const semVinculo = (await sql.query(`
  select p.numero_cnj, p.cliente_nome
  from processos p
  where p.excluido_em is null
    and coalesce(p.cliente_nome, '') <> ''
    and not exists (select 1 from processo_partes pp where pp.processo_id = p.id)
  order by p.numero_cnj
`)) as Array<{ numero_cnj: string; cliente_nome: string }>;

// Litisconsorte nao e divergencia: o cache guarda UM nome e o processo pode ter varios
// vinculos. So reporta quando o cache nao bate com NENHUM dos vinculados.
const cacheDivergente = (await sql.query(`
  select p.numero_cnj, p.cliente_nome, c.nome as nome_vinculado, pp.origem, pp.papel
  from processo_partes pp
  join processos p on p.id = pp.processo_id and p.excluido_em is null
  join clientes c on c.id = pp.cliente_id
  where coalesce(p.cliente_nome, '') <> c.nome
    and not exists (
      select 1 from processo_partes pp2
      join clientes c2 on c2.id = pp2.cliente_id
      where pp2.processo_id = p.id and c2.nome = p.cliente_nome
    )
  order by p.numero_cnj
`)) as Array<{
  numero_cnj: string;
  cliente_nome: string | null;
  nome_vinculado: string;
  origem: string | null;
  papel: string;
}>;

const clientes = (await sql.query(
  `select id, nome from clientes where nome is not null and nome <> '' order by nome`,
)) as Array<{ id: string; nome: string }>;

const porChave = new Map<string, Array<{ id: string; nome: string }>>();
for (const c of clientes) {
  const chave = normalizarNome(c.nome);
  porChave.set(chave, [...(porChave.get(chave) ?? []), c]);
}
const duplicados = [...porChave.entries()].filter(([, lista]) => lista.length > 1);

const resumo = (await sql.query(`
  select
    (select count(*)::int from processos where excluido_em is null) as processos,
    (select count(*)::int from processo_partes) as vinculos,
    (select count(*)::int from processo_partes where origem = 'maquina') as vinculos_maquina,
    (select count(*)::int from processo_partes where origem = 'humana') as vinculos_humanos,
    (select count(*)::int from partes_detectadas) as deteccoes,
    (select count(*)::int from partes_detectadas where status = 'sugerido') as deteccoes_pendentes,
    (select count(*)::int from documentos where cliente_id is not null) as docs_na_pasta
`)) as Array<Record<string, number>>;

const r = resumo[0];
console.log("== Panorama ==");
console.log(`processos ativos:            ${r.processos}`);
console.log(`vinculos processo<->cliente: ${r.vinculos} (humanos ${r.vinculos_humanos}, maquina ${r.vinculos_maquina})`);
console.log(`deteccoes de parte:          ${r.deteccoes} (pendentes ${r.deteccoes_pendentes})`);
console.log(`documentos na pasta:         ${r.docs_na_pasta}`);

console.log(`\n== 1. Processo com cliente_nome e SEM vinculo relacional (${semVinculo.length}) ==`);
if (semVinculo.length === 0) console.log("nenhum");
for (const x of semVinculo) console.log(`  ${x.numero_cnj} -> ${x.cliente_nome}`);

console.log(`\n== 2. Cache cliente_nome divergente do vinculo (${cacheDivergente.length}) ==`);
if (cacheDivergente.length === 0) console.log("nenhum");
for (const x of cacheDivergente) {
  console.log(
    `  ${x.numero_cnj}: cache "${x.cliente_nome ?? "(vazio)"}" vs vinculo "${x.nome_vinculado}" ` +
      `(${x.papel}, origem ${x.origem ?? "?"})`,
  );
}

console.log(`\n== 3. Cliente duplicado por nome_chave (${duplicados.length}) ==`);
if (duplicados.length === 0) console.log("nenhum");
for (const [chave, lista] of duplicados) {
  console.log(`  ${chave}`);
  for (const c of lista) console.log(`    ${c.id}  ${c.nome}`);
}

console.log("\nNada foi gravado: este script so reporta.");
process.exit(0);
