/** Financeiro de um único escritório: consultas e rascunhos, sem enviar ou dar baixa. */
import { and, asc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
import { getDb } from "./db.js";
import { clientes, cobrancas } from "./schema.js";

export type FiltroCobrancas = "pendentes" | "atrasadas" | "a_vencer" | "pagas" | "canceladas" | "todas";
export type FiltroFinanceiro = { filtro?: FiltroCobrancas; clienteId?: string; ate?: string; limite?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function dataFinanceiraValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (ano < 1900 || ano > 9999) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export function hojeFinanceiro(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pega("year")}-${pega("month")}-${pega("day")}`;
}

/** Espelha a regra do painel: local brasileiro ou internacional com + explícito. */
export function telefoneWhatsapp(telefone: string | null): string | null {
  if (!telefone) return null;
  const limpo = telefone.trim();
  if (!/^\+?[\d\s().-]+$/.test(limpo)) return null;
  const digitos = limpo.replace(/\D/g, "");
  if (limpo.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digitos) ? digitos : null;
  if (/^55[1-9]\d\d{8,9}$/.test(digitos)) return digitos;
  if (/^[1-9]\d\d{8,9}$/.test(digitos)) return `55${digitos}`;
  return null;
}

const selecao = {
  id: cobrancas.id, clienteId: cobrancas.clienteId, clienteNome: clientes.nome,
  clienteTelefone: clientes.telefone, descricao: cobrancas.descricao,
  valorCentavos: cobrancas.valorCentavos, vencimento: cobrancas.vencimento,
  status: cobrancas.status, pagoEm: cobrancas.pagoEm,
};

export async function listarCobrancasBanco(f: FiltroFinanceiro = {}) {
  const filtro = f.filtro ?? "pendentes";
  const permitidos: FiltroCobrancas[] = ["pendentes", "atrasadas", "a_vencer", "pagas", "canceladas", "todas"];
  if (!permitidos.includes(filtro)) throw new Error("Filtro financeiro inválido.");
  const limite = f.limite ?? 30;
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new Error("Limite precisa estar entre 1 e 100.");
  if (f.clienteId && !UUID.test(f.clienteId)) throw new Error("Cliente inválido: informe o UUID do cadastro.");
  if (f.ate && !dataFinanceiraValida(f.ate)) throw new Error("Data inválida: use AAAA-MM-DD.");
  const hoje = hojeFinanceiro();
  const conds: SQL[] = [];
  if (filtro === "pagas") conds.push(eq(cobrancas.status, "pago"));
  else if (filtro === "canceladas") conds.push(eq(cobrancas.status, "cancelado"));
  else if (filtro !== "todas") {
    conds.push(eq(cobrancas.status, "pendente"));
    if (filtro === "atrasadas") conds.push(lt(cobrancas.vencimento, hoje));
    if (filtro === "a_vencer") conds.push(gte(cobrancas.vencimento, hoje));
  }
  if (f.clienteId) conds.push(eq(cobrancas.clienteId, f.clienteId));
  if (f.ate) conds.push(lte(cobrancas.vencimento, f.ate));
  const rows = await getDb().select(selecao).from(cobrancas)
    .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id)).where(and(...conds))
    .orderBy(asc(cobrancas.vencimento), asc(cobrancas.criadoEm)).limit(limite + 1);
  return { referenciaData: hoje, fuso: "America/Cuiaba", filtro, limite, temMais: rows.length > limite, cobrancas: rows.slice(0, limite), moeda: "BRL" };
}

export type CobrancaParaRascunho = {
  id: string; clienteId: string; clienteNome: string; clienteTelefone: string | null;
  descricao: string; valorCentavos: number; vencimento: string;
  status: "pendente" | "pago" | "cancelado";
};

export function prepararRascunhoCobranca(c: CobrancaParaRascunho, hoje = hojeFinanceiro()) {
  if (c.status !== "pendente") throw new Error("Só cobranças pendentes podem gerar lembrete.");
  if (!dataFinanceiraValida(c.vencimento) || !dataFinanceiraValida(hoje)) throw new Error("Data financeira inválida.");
  if (!Number.isInteger(c.valorCentavos) || c.valorCentavos <= 0 || c.valorCentavos > 2_147_483_647) throw new Error("Valor financeiro inválido.");
  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valorCentavos / 100);
  const quando = c.vencimento < hoje ? "com vencimento em" : "com vencimento previsto para";
  const data = c.vencimento.split("-").reverse().join("/");
  const textoRascunho = `Olá, ${c.clienteNome}! Tudo bem?\n\nPassando para lembrar do pagamento referente a ${c.descricao}, no valor de ${valor}, ${quando} ${data}.\n\nSe você já realizou o pagamento, por favor desconsidere este lembrete e nos encaminhe o comprovante para conferência. Se precisar, estamos à disposição para conversar.\n\nObrigado!`;
  const telefone = telefoneWhatsapp(c.clienteTelefone);
  return {
    cobrancaId: c.id, clienteId: c.clienteId, clienteNome: c.clienteNome,
    valorCentavos: c.valorCentavos, moeda: "BRL", vencimento: c.vencimento,
    textoRascunho, linkWhatsapp: telefone ? `https://wa.me/${telefone}?text=${encodeURIComponent(textoRascunho)}` : null,
    status: "rascunho" as const, enviado: false, requerRevisao: true,
    nota: "Revise destinatário e pagamento antes de enviar. Preparar ou abrir o link não envia mensagem nem registra envio.",
  };
}

export async function prepararCobrancaBanco(cobrancaId: string) {
  if (!UUID.test(cobrancaId)) throw new Error("Cobrança inválida: informe o UUID do registro.");
  const [cobranca] = await getDb().select(selecao).from(cobrancas)
    .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id)).where(eq(cobrancas.id, cobrancaId)).limit(1);
  if (!cobranca) throw new Error("Cobrança não encontrada no escritório.");
  return prepararRascunhoCobranca(cobranca);
}
