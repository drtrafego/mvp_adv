import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), update: vi.fn(), insert: vi.fn(),
  limite: vi.fn(), whereUpdate: vi.fn(), retornarUpdate: vi.fn(), retornarInsert: vi.fn(),
}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: () => mocks }));

import { carregarFeriadosForenses, inserirPrazoSugerido, registrarFeriado, salvarPeca } from "./db.js";
import { calcularPrazo } from "./prazos.js";

const processoId = "00000000-0000-4000-8000-000000000001";
const comunicacaoId = "00000000-0000-4000-8000-000000000002";
const pecaId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://example:example@localhost/example");
  const select = { from: vi.fn(), where: vi.fn(), limit: mocks.limite };
  select.from.mockReturnValue(select);
  select.where.mockReturnValue(select);
  mocks.select.mockReturnValue(select);
  const update = { set: vi.fn(), where: mocks.whereUpdate, returning: mocks.retornarUpdate };
  update.set.mockReturnValue(update);
  mocks.whereUpdate.mockReturnValue(update);
  mocks.update.mockReturnValue(update);
  const insert = { values: vi.fn(), returning: mocks.retornarInsert };
  insert.values.mockReturnValue(insert);
  mocks.insert.mockReturnValue(insert);
});

afterEach(() => vi.unstubAllEnvs());

describe("calendário forense sem falha silenciosa", () => {
  it("propaga falha real da consulta mockada, em vez de devolver lista vazia", async () => {
    const falhaBanco = new Error("Consulta indisponível no teste");
    mocks.select.mockReturnValueOnce({
      from: () => ({ where: vi.fn().mockRejectedValue(falhaBanco) }),
    });
    const erro = await carregarFeriadosForenses("TJMT").catch((e) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toContain("O cálculo foi interrompido");
    expect(erro.cause).toBe(falhaBanco);
    expect(mocks.select).toHaveBeenCalledOnce();
  });

  it("calendário consultado com sucesso pode estar vazio", async () => {
    mocks.select.mockReturnValueOnce({ from: () => ({ where: vi.fn().mockResolvedValue([]) }) });
    expect(await carregarFeriadosForenses("TJMT")).toEqual([]);
    expect(mocks.select).toHaveBeenCalledOnce();
  });

  it("banco ausente não vira calendário vazio válido", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(carregarFeriadosForenses("TJMT")).rejects.toThrow(/cálculo foi interrompido/);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each(["2026-02-31", "infinity", "03/10/2026"])("recusa feriado inválido antes de persistir: %s", async (data) => {
    await expect(registrarFeriado("TJMT", data)).rejects.toThrow(/Data/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("persistência de sugestões sem decisão humana", () => {
  it("protege peça humana no próprio UPDATE, mesmo com aprovação concorrente", async () => {
    mocks.retornarUpdate.mockResolvedValue([]);
    expect(await salvarPeca({ pecaId, tipo: "inicial", conteudo: "Rascunho do agente" })).toBeNull();
    expect(mocks.select).not.toHaveBeenCalled();
    const predicado = new PgDialect().sqlToQuery(mocks.whereUpdate.mock.calls[0][0]);
    expect(predicado.sql).toContain('"pecas"."origem"');
    expect(predicado.params).toEqual([pecaId, "maquina"]);
  });

  it("reexecução do mesmo ato e comunicação reutiliza prazo vivo sem sobrescrever", async () => {
    mocks.limite.mockResolvedValueOnce([{ processoId }]).mockResolvedValueOnce([{ id: "prazo-existente" }]);
    const resultado = await inserirPrazoSugerido({
      processoId, comunicacaoId, ato: "Réplica",
      calculo: calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "replica" }),
    });
    expect(resultado).toEqual({ id: "prazo-existente", criado: false });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recusa prazo vinculado a processo diferente da intimação", async () => {
    mocks.limite.mockResolvedValueOnce([{ processoId: "outro-processo" }]);
    await expect(inserirPrazoSugerido({
      processoId, comunicacaoId, ato: "Réplica",
      calculo: calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "replica" }),
    })).rejects.toThrow(/não corresponde/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
