import { describe, it, expect } from "vitest";
import { calcularPrazo } from "./prazos.js";
import {
  pascoa,
  ehRecessoForense,
  parseISODate,
  criarCalendario,
  formatISODate,
} from "./feriados.js";

describe("cálculo da Páscoa (Meeus)", () => {
  it("acerta datas conhecidas", () => {
    expect(formatISODate(pascoa(2026))).toBe("2026-04-05");
    expect(formatISODate(pascoa(2025))).toBe("2025-04-20");
    expect(formatISODate(pascoa(2024))).toBe("2024-03-31");
  });
});

describe("recesso forense art. 220", () => {
  it("marca 20/12 a 20/01 como recesso", () => {
    expect(ehRecessoForense(parseISODate("2026-12-20"))).toBe(true);
    expect(ehRecessoForense(parseISODate("2026-12-31"))).toBe(true);
    expect(ehRecessoForense(parseISODate("2027-01-20"))).toBe(true);
    expect(ehRecessoForense(parseISODate("2027-01-21"))).toBe(false);
    expect(ehRecessoForense(parseISODate("2026-12-19"))).toBe(false);
  });
});

describe("calendário de dias úteis", () => {
  const cal = criarCalendario();
  it("exclui fim de semana e feriados nacionais", () => {
    expect(cal.ehDiaUtil(parseISODate("2026-03-07"))).toBe(false); // sábado
    expect(cal.ehDiaUtil(parseISODate("2026-03-08"))).toBe(false); // domingo
    expect(cal.ehDiaUtil(parseISODate("2026-05-01"))).toBe(false); // dia do trabalho
    expect(cal.ehDiaUtil(parseISODate("2026-04-03"))).toBe(false); // sexta-feira santa
    expect(cal.ehDiaUtil(parseISODate("2026-03-05"))).toBe(true); // quinta comum
  });
  it("respeita feriado forense local injetado", () => {
    const calLocal = criarCalendario({ feriadosForenses: ["2026-03-05"] });
    expect(calLocal.ehDiaUtil(parseISODate("2026-03-05"))).toBe(false);
  });
});

describe("calcularPrazo — dias úteis (CPC art. 219)", () => {
  it("prazo de 15 dias úteis a partir de disponibilização em dia comum", () => {
    // Disp 03/03/2026 (ter) -> publicação 04/03 (qua) -> início 05/03 (qui) -> fatal 25/03
    const r = calcularPrazo({ dataDisponibilizacao: "2026-03-03", dias: 15 });
    expect(r.dataPublicacao).toBe("2026-03-04");
    expect(r.dataInicioContagem).toBe("2026-03-05");
    expect(r.dataFatal).toBe("2026-03-25");
    expect(r.diasEfetivos).toBe(15);
  });

  it("prazo em dobro (30 dias úteis) pula a Sexta-feira Santa", () => {
    const r = calcularPrazo({ dataDisponibilizacao: "2026-03-03", dias: 15, dobro: true });
    expect(r.diasEfetivos).toBe(30);
    expect(r.dataFatal).toBe("2026-04-16");
  });

  it("prazo que atravessa o recesso do art. 220 salta para depois de 20/01", () => {
    // Publicação conhecida 17/12/2026 (qui) -> início 18/12 (sex, dia 1)
    // dias úteis seguintes pulam 20/12->20/01. Fatal 26/01/2027.
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-12-17",
      dataPublicacaoConhecida: "2026-12-17",
      dias: 5,
    });
    expect(r.dataInicioContagem).toBe("2026-12-18");
    expect(r.dataFatal).toBe("2027-01-26");
  });
});

describe("calcularPrazo — dias corridos com prorrogação", () => {
  it("prorroga o vencimento em dia não útil para o próximo dia útil (art. 224 §1º)", () => {
    // Publicação conhecida 20/03/2026 (sex) -> início 21/03 (sáb) -> +5 corridos = 25/03? não:
    // início 21/03, 5 dias corridos: 21,22,23,24,25 -> fatal 25/03 (qua, útil).
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-20",
      dataPublicacaoConhecida: "2026-03-20",
      dias: 5,
      contagem: "corridos",
    });
    expect(r.dataFatal).toBe("2026-03-25");
  });
});
