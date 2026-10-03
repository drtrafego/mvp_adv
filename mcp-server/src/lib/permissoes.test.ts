import { afterEach, describe, expect, it, vi } from "vitest";
import { exigirModoHumano } from "./permissoes.js";

afterEach(() => vi.unstubAllEnvs());

describe("fronteira entre agente e decisão humana", () => {
  it.each([undefined, "", "true", "advogado", "0"])("nega modo humano quando configuração é %s", (valor) => {
    vi.stubEnv("GABINETE_MCP_MODO_HUMANO", valor);
    expect(() => exigirModoHumano()).toThrow(/reservada ao advogado/);
  });
  it("só libera na sessão explicitamente configurada para o advogado", () => {
    vi.stubEnv("GABINETE_MCP_MODO_HUMANO", "1");
    expect(() => exigirModoHumano()).not.toThrow();
  });
});
