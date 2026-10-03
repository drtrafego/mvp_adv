"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cobrancas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth";
import { dataFinanceiraValida, hojeFinanceiro, UUID_VALIDO, valorParaCentavos } from "@/lib/financeiro";

export type FinanceiroState = { ok?: boolean; erro?: string; mensagem?: string };

export async function criarCobrancaAction(_prev: FinanceiroState, form: FormData): Promise<FinanceiroState> {
  const usuario = await exigirUsuario();
  if (!db) return { erro: "Banco não conectado." };
  const clienteId = String(form.get("cliente_id") ?? "");
  const descricao = String(form.get("descricao") ?? "").trim();
  const vencimento = String(form.get("vencimento") ?? "");
  const valorCentavos = valorParaCentavos(String(form.get("valor") ?? ""));
  if (!UUID_VALIDO.test(clienteId)) return { erro: "Escolha um cliente cadastrado." };
  if (!descricao || descricao.length > 200) return { erro: "Informe uma descrição com até 200 caracteres." };
  if (!dataFinanceiraValida(vencimento)) return { erro: "Informe uma data de vencimento válida." };
  if (valorCentavos === null) return { erro: "Informe um valor positivo em reais, com até duas casas decimais (ex.: 1.250,50)." };
  try {
    const [cliente] = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.id, clienteId)).limit(1);
    if (!cliente) return { erro: "Cliente não encontrado. Atualize a página e escolha novamente." };
    await db.insert(cobrancas).values({ clienteId, descricao, valorCentavos, vencimento, criadoPor: usuario.id, atualizadoPor: usuario.id });
  } catch {
    return { erro: "Não foi possível salvar a cobrança. Verifique a conexão e a atualização do banco." };
  }
  revalidatePath("/financeiro");
  return { ok: true, mensagem: "Cobrança cadastrada. Nenhuma mensagem foi enviada." };
}

export async function registrarPagamentoAction(id: string, pagoEm: string): Promise<FinanceiroState> {
  const usuario = await exigirUsuario();
  if (!db) return { erro: "Banco não conectado." };
  if (!UUID_VALIDO.test(id)) return { erro: "Cobrança inválida." };
  if (!dataFinanceiraValida(pagoEm) || pagoEm > hojeFinanceiro()) return { erro: "Informe a data real do recebimento, até hoje." };
  try {
    const alteradas = await db.update(cobrancas)
      .set({ status: "pago", pagoEm, atualizadoPor: usuario.id, atualizadoEm: new Date() })
      .where(and(eq(cobrancas.id, id), eq(cobrancas.status, "pendente")))
      .returning({ id: cobrancas.id });
    if (alteradas.length === 0) return { erro: "A cobrança já foi paga, cancelada ou não existe. Atualize a lista." };
  } catch {
    return { erro: "Não foi possível registrar o recebimento. Tente novamente." };
  }
  revalidatePath("/financeiro");
  return { ok: true, mensagem: "Recebimento registrado." };
}

export async function cancelarCobrancaAction(id: string): Promise<FinanceiroState> {
  const usuario = await exigirUsuario();
  if (!db) return { erro: "Banco não conectado." };
  if (!UUID_VALIDO.test(id)) return { erro: "Cobrança inválida." };
  try {
    const alteradas = await db.update(cobrancas)
      .set({ status: "cancelado", atualizadoPor: usuario.id, atualizadoEm: new Date() })
      .where(and(eq(cobrancas.id, id), eq(cobrancas.status, "pendente")))
      .returning({ id: cobrancas.id });
    if (alteradas.length === 0) return { erro: "Só cobranças pendentes podem ser canceladas. Atualize a lista." };
  } catch {
    return { erro: "Não foi possível cancelar a cobrança. Tente novamente." };
  }
  revalidatePath("/financeiro");
  return { ok: true, mensagem: "Cobrança cancelada; o registro permanece no histórico." };
}
