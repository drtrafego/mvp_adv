import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cobrancas } from "@/db/schema";
import type { CobrancaLinha } from "@/lib/financeiro";

export type ClienteFinanceiro = { id: string; nome: string };
export type ResumoFinanceiro = { emAberto: number; emAtraso: number; recebido: number; totalPendentes: number };
export type DadosFinanceiros = {
  cobrancas: CobrancaLinha[];
  clientes: ClienteFinanceiro[];
  resumo: ResumoFinanceiro;
  listaLimitada: boolean;
  indisponivel?: "sem_banco" | "migracao" | "erro";
};

const vazio: DadosFinanceiros = {
  cobrancas: [], clientes: [], listaLimitada: false,
  resumo: { emAberto: 0, emAtraso: 0, recebido: 0, totalPendentes: 0 },
};

function tabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const obj = erro as { code?: string; cause?: unknown };
  return obj.code === "42P01" || (obj.cause !== erro && tabelaAusente(obj.cause));
}

/** Consulta do escritório compartilhado, protegida pela sessão na página. Nunca inventa saldos. */
export async function carregarFinanceiro(hoje: string): Promise<DadosFinanceiros> {
  if (!db) return { ...vazio, indisponivel: "sem_banco" };
  try {
    const [linhas, carteira, totais] = await Promise.all([
      db.select({
        id: cobrancas.id, clienteId: cobrancas.clienteId, clienteNome: clientes.nome,
        clienteTelefone: clientes.telefone, descricao: cobrancas.descricao,
        valorCentavos: cobrancas.valorCentavos, vencimento: cobrancas.vencimento,
        status: cobrancas.status, pagoEm: cobrancas.pagoEm,
      }).from(cobrancas).innerJoin(clientes, eq(cobrancas.clienteId, clientes.id))
        .orderBy(sql`case when ${cobrancas.status} = 'pendente' then 0 else 1 end`, asc(cobrancas.vencimento), asc(cobrancas.criadoEm)).limit(501),
      db.select({ id: clientes.id, nome: clientes.nome }).from(clientes).orderBy(asc(clientes.nome)),
      db.select({
        emAberto: sql<string>`coalesce(sum(case when ${cobrancas.status} = 'pendente' then ${cobrancas.valorCentavos} else 0 end), 0)::text`,
        emAtraso: sql<string>`coalesce(sum(case when ${cobrancas.status} = 'pendente' and ${cobrancas.vencimento} < ${hoje}::date then ${cobrancas.valorCentavos} else 0 end), 0)::text`,
        recebido: sql<string>`coalesce(sum(case when ${cobrancas.status} = 'pago' then ${cobrancas.valorCentavos} else 0 end), 0)::text`,
        totalPendentes: sql<number>`count(*) filter (where ${cobrancas.status} = 'pendente')::int`,
      }).from(cobrancas),
    ]);
    const total = totais[0];
    return {
      cobrancas: linhas.slice(0, 500), clientes: carteira, listaLimitada: linhas.length > 500,
      resumo: {
        emAberto: Number(total?.emAberto ?? 0), emAtraso: Number(total?.emAtraso ?? 0),
        recebido: Number(total?.recebido ?? 0), totalPendentes: total?.totalPendentes ?? 0,
      },
    };
  } catch (erro) {
    return { ...vazio, indisponivel: tabelaAusente(erro) ? "migracao" : "erro" };
  }
}
