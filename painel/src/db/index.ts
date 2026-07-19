import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

type DB = ReturnType<typeof drizzleNeon<typeof schema>>;

/**
 * Cliente Drizzle do painel. Se DATABASE_URL não estiver setado, `db` é null e a UI
 * mostra o estado de "banco não conectado" em vez de quebrar (útil no primeiro deploy).
 *
 * Driver por host: um Postgres local (localhost/127.0.0.1) usa postgres-js — útil para
 * rodar e testar sem o Neon. Qualquer outro host usa o driver HTTP da Neon (produção).
 */
function criarDb(): DB | null {
  if (!url) return null;
  const local = url.includes("localhost") || url.includes("127.0.0.1");
  if (local) {
    return drizzlePg(postgres(url), { schema }) as unknown as DB;
  }
  return drizzleNeon(neon(url), { schema });
}

export const db = criarDb();

export function bancoConectado(): boolean {
  return db !== null;
}

export { schema };
