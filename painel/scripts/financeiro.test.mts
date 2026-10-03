import { test } from "node:test";
import assert from "node:assert/strict";
import { valorParaCentavos, dataFinanceiraValida, hojeFinanceiro, cobrancaNoFiltro, telefoneWhatsapp, linkWhatsapp, textoCobranca } from "../src/lib/financeiro.ts";

test("converte BRL em centavos sem erro de ponto flutuante", () => {
  for (const [valor, esperado] of [["0,29", 29], ["1.250,50", 125050], ["1250.5", 125050], ["R$ 12,34", 1234], ["21474836,47", 2147483647]] as const) {
    assert.equal(valorParaCentavos(valor), esperado);
  }
  for (const valor of ["0", "-10", "1e3", "NaN", "12,345", "1.234", "1,234.00", "21474836,48", "", "10 reais"]) assert.equal(valorParaCentavos(valor), null);
});

test("datas financeiras seguem calendário e fuso do escritório", () => {
  assert.equal(dataFinanceiraValida("2024-02-29"), true);
  for (const data of ["2025-02-29", "2026-02-31", "2026-13-01", "2026-01-00", "2026-2-01", "0099-01-01"]) assert.equal(dataFinanceiraValida(data), false);
  assert.equal(hojeFinanceiro(new Date("2026-10-03T01:59:00Z")), "2026-10-02");
  assert.equal(hojeFinanceiro(new Date("2026-10-03T03:59:00Z")), "2026-10-02");
  assert.equal(hojeFinanceiro(new Date("2026-10-03T04:00:00Z")), "2026-10-03");
});

test("vencimento de hoje não está atrasado e pagos não recebem filtro pendente", () => {
  const hoje = "2026-10-02";
  assert.equal(cobrancaNoFiltro({ status: "pendente", vencimento: hoje }, "atrasadas", hoje), false);
  assert.equal(cobrancaNoFiltro({ status: "pendente", vencimento: hoje }, "a_vencer", hoje), true);
  assert.equal(cobrancaNoFiltro({ status: "pendente", vencimento: "2026-10-01" }, "atrasadas", hoje), true);
  assert.equal(cobrancaNoFiltro({ status: "pago", vencimento: "2026-10-01" }, "pendentes", hoje), false);
  assert.equal(cobrancaNoFiltro({ status: "cancelado", vencimento: "2026-10-01" }, "canceladas", hoje), true);
});

test("link de WhatsApp aceita formato telefônico e codifica o rascunho", () => {
  assert.equal(telefoneWhatsapp("(65) 99629-1980"), "5565996291980");
  assert.equal(telefoneWhatsapp("5565996291980"), "5565996291980");
  assert.equal(telefoneWhatsapp("+54 9 11 1234-5678"), "5491112345678");
  for (const telefone of [null, "", "123", "abc65996291980", "javascript:65996291980", "+000123456789", "65996291980 ramal 2"]) assert.equal(telefoneWhatsapp(telefone), null);
  assert.equal(linkWhatsapp("(65) 99629-1980", "Olá & bom dia!"), "https://wa.me/5565996291980?text=Ol%C3%A1%20%26%20bom%20dia!");
});

test("rascunho inclui só dados financeiros do cliente e data legível", () => {
  const texto = textoCobranca({ clienteNome: "Maria", descricao: "Honorários", valorCentavos: 125050, vencimento: "2026-10-02" }, "2026-10-02");
  assert.match(texto, /Olá, Maria!/);
  assert.match(texto, /1\.250,50/);
  assert.match(texto, /02\/10\/2026/);
  assert.match(texto, /Se você já realizou o pagamento/);
});
