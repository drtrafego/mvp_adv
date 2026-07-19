import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

/**
 * Cliente Drizzle/Neon do painel. Se DATABASE_URL não estiver setado, `db` é null e a UI
 * mostra o estado de "banco não conectado" em vez de quebrar (útil no primeiro deploy).
 */
export const db = url ? drizzle(neon(url), { schema }) : null;

export function bancoConectado(): boolean {
  return db !== null;
}

export { schema };
