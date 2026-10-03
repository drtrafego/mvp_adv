import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Saida = { isError?: boolean; content: Array<{ type: string; text?: string }> };
type Handler = (argumentos: Record<string, unknown>) => Promise<Saida>;

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  select: vi.fn(), insert: vi.fn(), values: vi.fn(), conflito: vi.fn(),
}));

// Apenas transporte/driver são substituídos. Os handlers registrados pelo index.ts,
// a regra de permissão e as funções de calendário/persistência são executados de verdade.
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool(nome: string, _configuracao: unknown, handler: Handler) {
      mocks.handlers.set(nome, handler);
    }
    async connect() {}
  },
}));
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({ StdioServerTransport: class {} }));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: () => mocks }));

beforeAll(async () => {
  // Impede leitura de .env local: a inicialização recebe somente valores fictícios.
  vi.stubEnv("DATABASE_URL", "postgresql://example:example@localhost/example");
  vi.stubEnv("OAB_ADVOGADO", "99999/MT");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try { await import("./index.js"); } finally { log.mockRestore(); }
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://example:example@localhost/example");
  vi.stubEnv("OAB_ADVOGADO", "99999/MT");
  vi.stubEnv("GABINETE_MCP_MODO_HUMANO", "0");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede proibida neste teste"); }));
  const insert = { values: mocks.values, onConflictDoUpdate: mocks.conflito };
  mocks.values.mockReturnValue(insert);
  mocks.conflito.mockResolvedValue(undefined);
  mocks.insert.mockReturnValue(insert);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const executar = (nome: string, argumentos: Record<string, unknown>) => {
  const handler = mocks.handlers.get(nome);
  if (!handler) throw new Error(`Tool não registrada: ${nome}`);
  return handler(argumentos);
};
const conteudo = (saida: Saida) => saida.content.map((item) => item.text ?? "").join("\n");

describe("tools de calendário respeitam permissão e falha de leitura", () => {
  it("registrar_feriado em modo agente recusa a chamada antes de acessar o banco", async () => {
    const saida = await executar("registrar_feriado", { tribunal: "TJMT", data: "2026-10-03" });
    expect(saida.isError).toBe(true);
    expect(conteudo(saida)).toContain("reservada ao advogado");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("sessão humana permite registrar uma data válida pela função real de persistência", async () => {
    vi.stubEnv("GABINETE_MCP_MODO_HUMANO", "1");
    const saida = await executar("registrar_feriado", { tribunal: "TJMT", data: "2026-10-03" });
    expect(saida.isError).not.toBe(true);
    expect(conteudo(saida)).toContain("Feriado forense registrado");
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.values).toHaveBeenCalledWith({ tribunal: "TJMT", data: "2026-10-03", descricao: undefined, tipo: "feriado" });
  });

  it("mesmo sessão humana não pode registrar data inexistente", async () => {
    vi.stubEnv("GABINETE_MCP_MODO_HUMANO", "1");
    const saida = await executar("registrar_feriado", { tribunal: "TJMT", data: "2026-02-31" });
    expect(saida.isError).toBe(true);
    expect(conteudo(saida)).toContain("Data inexistente");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("calcular_prazo não calcula nem grava se a consulta de calendário falha", async () => {
    mocks.select.mockReturnValueOnce({
      from: () => ({ where: vi.fn().mockRejectedValue(new Error("Falha do driver mockado")) }),
    });
    const saida = await executar("calcular_prazo", {
      tribunal: "TJMT", data_disponibilizacao: "2026-10-02", ato_chave: "replica", persistir: true,
    });
    expect(saida.isError).toBe(true);
    expect(conteudo(saida)).toContain("O cálculo foi interrompido");
    expect(conteudo(saida)).not.toContain("DATA FATAL");
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
