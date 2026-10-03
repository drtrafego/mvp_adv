/** Regras de honorários: reais no formulário, centavos inteiros no banco. Sem I/O. */
export type StatusCobranca = "pendente" | "pago" | "cancelado";
export type FiltroCobranca = "pendentes" | "atrasadas" | "a_vencer" | "pagas" | "canceladas" | "todas";

export type CobrancaLinha = {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  status: StatusCobranca;
  pagoEm: string | null;
};

const MAX_CENTAVOS = 2_147_483_647;
export const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Aceita 1250, 1250,50, 1.250,50 ou 1250.50. Rejeita frações extras e notação científica. */
export function valorParaCentavos(entrada: string): number | null {
  const valor = entrada.trim().replace(/^R\$\s*/, "");
  let normalizado: string;
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(valor)) {
    normalizado = valor.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+(?:[,.]\d{1,2})?$/.test(valor)) {
    normalizado = valor.replace(",", ".");
  } else {
    return null;
  }
  const [inteiro, fracao = ""] = normalizado.split(".");
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos > 0 && centavos <= MAX_CENTAVOS ? centavos : null;
}

/** Confere o calendário, sem aceitar normalização de 31/02 para março pelo Date. */
export function dataFinanceiraValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (ano < 1900 || ano > 9999) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/** Dia financeiro do escritório. Não depende do fuso do servidor ou do navegador. */
export function hojeFinanceiro(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pega("year")}-${pega("month")}-${pega("day")}`;
}

export function formatarValor(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

export function formatarDataFinanceira(data: string): string {
  return dataFinanceiraValida(data) ? data.split("-").reverse().join("/") : "Data inválida";
}

export function cobrancaNoFiltro(c: Pick<CobrancaLinha, "status" | "vencimento">, filtro: FiltroCobranca, hoje: string): boolean {
  if (filtro === "todas") return true;
  if (filtro === "pagas") return c.status === "pago";
  if (filtro === "canceladas") return c.status === "cancelado";
  if (c.status !== "pendente") return false;
  if (filtro === "atrasadas") return c.vencimento < hoje;
  if (filtro === "a_vencer") return c.vencimento >= hoje;
  return true;
}

/** Telefones brasileiros locais ganham DDI 55. Internacionais exigem + e E.164. */
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

export function textoCobranca(c: Pick<CobrancaLinha, "clienteNome" | "descricao" | "valorCentavos" | "vencimento">, hoje: string): string {
  const quando = c.vencimento < hoje ? "com vencimento em" : "com vencimento previsto para";
  return `Olá, ${c.clienteNome}! Tudo bem?\n\nPassando para lembrar do pagamento referente a ${c.descricao}, no valor de ${formatarValor(c.valorCentavos)}, ${quando} ${formatarDataFinanceira(c.vencimento)}.\n\nSe você já realizou o pagamento, por favor desconsidere este lembrete e nos encaminhe o comprovante para conferência. Se precisar, estamos à disposição para conversar.\n\nObrigado!`;
}

export function linkWhatsapp(telefone: string | null, texto: string): string | null {
  const numero = telefoneWhatsapp(telefone);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}
