import { afterEach, describe, expect, it, vi } from "vitest";
import { diasOperacionais, deslocarData, hojeEscritorio } from "./tempo.js";

afterEach(() => vi.unstubAllEnvs());

describe("datas operacionais no fuso do escritório", () => {
  it("usa o dia de Cuiabá quando UTC já passou de meia-noite", () => {
    vi.stubEnv("GABINETE_TIMEZONE", "America/Cuiaba");
    expect(hojeEscritorio(new Date("2026-10-03T02:00:00Z"))).toBe("2026-10-02");
  });
  it("desloca datas de calendário atravessando o ano bissexto", () => {
    expect(deslocarData("2028-03-01", -1)).toBe("2028-02-29");
  });
  it.each(["NaN", "-2", "0", "1.5", "Infinity", "3651"])("recusa dias inválidos em cron: %s", (valor) => {
    expect(() => diasOperacionais(valor)).toThrow(/inteiro/);
  });
});
