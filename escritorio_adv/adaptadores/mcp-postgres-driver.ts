/**
 * Adaptador de Driver Postgres Local vs Neon HTTP para o MCP do mvp_adv.
 * Localização no mvp_adv: mcp-server/src/lib/db.ts (ou mcp-server/src/lib/postgres-driver.ts)
 * 
 * Resolve a limitação identificada:
 * O mcp-server original usava exclusivamente neon-http, impossibilitando rodar em
 * um único servidor Hetzner de 4 vCPU com Postgres local (127.0.0.1:5432).
 */

import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface DatabaseConfig {
  databaseUrl: string;
  driver?: "postgres" | "neon" | "auto";
  maxConnections?: number;
}

/**
 * Cria ou retorna uma instância configurada do Drizzle ORM compatível tanto
 * com Postgres local no Hetzner (127.0.0.1) quanto Neon Serverless HTTP.
 */
export function createDatabaseConnection(config: DatabaseConfig) {
  const url = config.databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurada no ambiente.");
  }

  // Detecção inteligente do driver:
  // Se explicitamente 'postgres', ou se a URL apontar para localhost / 127.0.0.1, usa postgres-js.
  const isLocalHost = url.includes("127.0.0.1") || url.includes("localhost") || url.includes("postgres:");
  const driverMode = config.driver || (process.env.DATABASE_DRIVER as "postgres" | "neon") || (isLocalHost ? "postgres" : "neon");

  if (driverMode === "postgres" || isLocalHost) {
    // Driver nativo postgres-js para conexão via TCP / socket local
    const client = postgres(url, {
      max: config.maxConnections || 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return drizzlePostgres(client);
  }

  // Driver fallback para Neon HTTP (quando rodando fora do Hetzner ou em nuvem serverless)
  try {
    const { neon } = require("@neondatabase/serverless");
    const { drizzle: drizzleNeon } = require("drizzle-orm/neon-http");
    const sql = neon(url);
    return drizzleNeon(sql);
  } catch (err) {
    // Se o pacote neon não estiver instalado, utiliza postgres-js como padrão robusto
    const client = postgres(url, { max: config.maxConnections || 10 });
    return drizzlePostgres(client);
  }
}
