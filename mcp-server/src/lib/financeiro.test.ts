import { describe, expect, it, vi } from "vitest";
vi.mock("./db.js", () => ({ getDb: vi.fn(() => { throw new Error("Não consultar banco no teste."); }) }));
import { dataFinanceiraValida, hojeFinanceiro, listarCobrancasBanco, prepararCobrancaBanco, prepararRascunhoCobranca, telefoneWhatsapp } from "./financeiro.js";

const base = {
  id: "d22aad76-b722-4b56-b9cd-bd0c6a272a6b", clienteId: "bb89cd22-9ab5-4c56-aa97-2391f2a3b9f1",
  clienteNome: "Maria", clienteTelefone: "(65) 99629-1980", descricao: "Honorários",
  valorCentavos: 125050, vencimento: "2026-10-02", status: "pendente" as const,
};

describe("financeiro somente leitura", () => {
  it("prepara rascunho sem enviar e rejeita cobranças pagas/canceladas", () => {
    const rascunho = prepararRascunhoCobranca(base, "2026-10-02");
    expect(rascunho.enviado).toBe(false);
    expect(rascunho.requerRevisao).toBe(true);
    expect(rascunho.textoRascunho).toContain("1.250,50");
    expect(rascunho.linkWhatsapp).toContain("https://wa.me/5565996291980?text=");
    for (const status of ["pago", "cancelado"] as const) expect(() => prepararRascunhoCobranca({ ...base, status })).toThrow("pendentes");
  });
  it("rejeita dados financeiros inconsistentes", () => {
    expect(() => prepararRascunhoCobranca({ ...base, vencimento: "2026-02-31" })).toThrow("Data financeira");
    expect(() => prepararRascunhoCobranca({ ...base, valorCentavos: 0.1 })).toThrow("Valor financeiro");
    expect(dataFinanceiraValida("2024-02-29")).toBe(true);
    expect(dataFinanceiraValida("2025-02-29")).toBe(false);
    expect(hojeFinanceiro(new Date("2026-10-03T01:59:00Z"))).toBe("2026-10-02");
  });
  it("omite link quando telefone não pode ser validado", () => {
    expect(prepararRascunhoCobranca({ ...base, clienteTelefone: "texto 65996291980" }).linkWhatsapp).toBeNull();
    expect(telefoneWhatsapp("+54 9 11 1234-5678")).toBe("5491112345678");
    expect(telefoneWhatsapp("+000123456789")).toBeNull();
  });
  it("valida parâmetros antes de consultar o banco", async () => {
    await expect(listarCobrancasBanco({ limite: 1000 })).rejects.toThrow("Limite");
    await expect(listarCobrancasBanco({ ate: "2026-02-31" })).rejects.toThrow("Data inválida");
    await expect(listarCobrancasBanco({ clienteId: "falso" })).rejects.toThrow("Cliente inválido");
    await expect(prepararCobrancaBanco("falso")).rejects.toThrow("Cobrança inválida");
  });
});
