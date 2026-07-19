/**
 * Cria (ou atualiza a senha de) o usuario do painel.
 *
 *   pnpm criar-advogado <email> <senha> "[nome]" "[oab]"
 *
 * Le DATABASE_URL do painel/.env. Como o projeto e de um advogado so, normalmente
 * roda uma vez para criar o unico login.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema.ts";

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

const [email, senha, nome, oab] = process.argv.slice(2);
if (!email || !senha) {
  console.error('uso: pnpm criar-advogado <email> <senha> "[nome]" "[oab]"');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL nao definido (painel/.env)");
  process.exit(1);
}

const db = drizzle(neon(url), { schema });
const senhaHash = await bcrypt.hash(senha, 12);

await db
  .insert(schema.usuarios)
  .values({ email: email.toLowerCase(), senhaHash, nome: nome ?? null, oab: oab ?? null })
  .onConflictDoUpdate({
    target: schema.usuarios.email,
    set: { senhaHash, nome: nome ?? null, oab: oab ?? null },
  });

console.log(`OK: usuario ${email} criado/atualizado.`);
process.exit(0);
