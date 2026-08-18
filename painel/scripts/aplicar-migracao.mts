/**
 * Aplica um arquivo SQL de painel/drizzle/ no banco apontado por DATABASE_URL.
 *
 *   pnpm migrar 0003_analise_intimacao.sql
 *
 * Existe porque `drizzle-kit push` compara o schema inteiro e se propõe a derrubar coluna que
 * ele não conhece. As migrações do projeto são escritas à mão, idempotentes, e entram uma a uma.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// carrega painel/.env sem depender de dotenv
try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const linha of env.split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* sem .env, usa o ambiente */
}

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: pnpm migrar <arquivo.sql em painel/drizzle/>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL nao definido (painel/.env)");
  process.exit(1);
}

const caminho = new URL(`../drizzle/${arquivo}`, import.meta.url);
const conteudo = readFileSync(caminho, "utf8");

// Cada comando vai sozinho: o driver HTTP do Neon nao aceita varios statements por chamada.
const comandos = conteudo
  .split(";")
  .map((c) =>
    c
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const sql = neon(url);
for (const comando of comandos) {
  await sql.query(comando);
  console.log(`OK: ${comando.split("\n")[0].slice(0, 90)}`);
}
console.log(`\n${comandos.length} comando(s) aplicado(s) de ${arquivo}.`);
process.exit(0);
