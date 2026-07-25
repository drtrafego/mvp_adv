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

// ---------------------------------------------------------------------------
// Catálogo por rito: o sistema não pode mais tratar tudo como 15 dias úteis.
// ---------------------------------------------------------------------------

describe("rito penal — dias corridos e contínuos (CPP art. 798)", () => {
  it("resposta à acusação: 10 dias CORRIDOS, não 15 úteis (art. 396)", () => {
    // Disp 03/03/2026 (ter) -> publicação 04/03 (qua) -> início 05/03 -> +10 corridos = 14/03
    // 14/03/2026 é sábado, prorroga para 16/03 (segunda).
    const r = calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "resposta-acusacao" });
    expect(r.contagem).toBe("corridos");
    expect(r.diasEfetivos).toBe(10);
    expect(r.dataFatal).toBe("2026-03-16");
    expect(r.rito).toBe("penal");
  });

  it("apelação criminal: 5 dias corridos para interpor, 8 para razões, 3 na contravenção", () => {
    const interpor = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "apelacao-penal-interposicao",
    });
    expect(interpor.diasEfetivos).toBe(5);
    expect(interpor.contagem).toBe("corridos");

    const razoes = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "apelacao-penal-razoes",
    });
    expect(razoes.diasEfetivos).toBe(8);

    const contravencao = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "apelacao-penal-razoes-contravencao",
    });
    expect(contravencao.diasEfetivos).toBe(3);
    expect(contravencao.contagem).toBe("corridos");
  });

  it("NÃO suspende no recesso de 20/12 a 20/01 (art. 798: prazos contínuos)", () => {
    // Ciência em 17/12/2026 -> início 18/12 -> +10 corridos = 27/12/2026 (domingo)
    // -> prorroga para 28/12 (segunda), que é dia comum fora do recesso do CPC.
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-12-17",
      dataPublicacaoConhecida: "2026-12-17",
      atoChave: "resposta-acusacao",
    });
    expect(r.dataFatal).toBe("2026-12-28");
  });

  it("não aplica prazo em dobro onde o ato não admite, e avisa", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "resposta-acusacao",
      dobro: true,
    });
    expect(r.dobro).toBe(false);
    expect(r.diasEfetivos).toBe(10);
    expect(r.alertas.some((a) => a.includes("dobro NÃO aplicado"))).toBe(true);
  });
});

describe("recuperação judicial e falência — dias corridos (Lei 11.101 art. 189 §1º I)", () => {
  it("habilitação de crédito: 15 dias CORRIDOS", () => {
    // Disp 03/03/2026 -> publicação 04/03 -> início 05/03 -> +15 corridos = 19/03 (qui, útil)
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "habilitacao-credito",
    });
    expect(r.contagem).toBe("corridos");
    expect(r.dataFatal).toBe("2026-03-19");
  });

  it("difere do prazo cível de 15 dias úteis para a mesma disponibilização", () => {
    const corridos = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "habilitacao-credito",
    });
    const uteis = calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "contestacao" });
    expect(corridos.dataFatal).not.toBe(uteis.dataFatal);
    expect(uteis.dataFatal).toBe("2026-03-25");
  });

  it("plano de recuperação: 60 dias corridos, com alerta de improrrogabilidade", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "plano-recuperacao",
    });
    expect(r.diasEfetivos).toBe(60);
    expect(r.alertas.some((a) => a.includes("IMPRORROGÁVEL"))).toBe(true);
  });
});

describe("rito trabalhista — 8 dias úteis (CLT arts. 775 e 895)", () => {
  it("recurso ordinário é de 8 dias úteis, não 15", () => {
    // Disp 03/03/2026 -> publicação 04/03 -> início 05/03 -> 8 dias úteis = 16/03
    const r = calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "recurso-ordinario" });
    expect(r.diasEfetivos).toBe(8);
    expect(r.contagem).toBe("uteis");
    expect(r.dataFatal).toBe("2026-03-16");
  });
});

describe("juizado especial cível — 10 dias úteis (Lei 9.099 arts. 42 e 12-A)", () => {
  it("recurso inominado é de 10 dias úteis", () => {
    const r = calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "recurso-inominado" });
    expect(r.diasEfetivos).toBe(10);
    expect(r.contagem).toBe("uteis");
    expect(r.dataFatal).toBe("2026-03-18");
  });

  it("não admite prazo diferenciado para o poder público", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "recurso-inominado",
      dobro: true,
    });
    expect(r.dobro).toBe(false);
  });
});

describe("prazo residual: lei silente é 5 dias, nunca 15 (CPC art. 218 §3º)", () => {
  it("manifestacao-generica conta 5 dias úteis", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "manifestacao-generica",
    });
    expect(r.diasEfetivos).toBe(5);
    expect(r.dataFatal).toBe("2026-03-11");
  });

  it("contrarrazões de embargos de declaração também são 5 dias (art. 1.023 §2º)", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "contrarrazoes-embargos-declaracao",
    });
    expect(r.diasEfetivos).toBe(5);
  });

  it("recusa o cálculo quando não recebe ato nem dias, apontando o prazo residual", () => {
    expect(() => calcularPrazo({ dataDisponibilizacao: "2026-03-03" })).toThrow(
      /manifestacao-generica/,
    );
  });
});

describe("prazo material (decadencial) — fora da regra do art. 219", () => {
  it("mandado de segurança: 120 dias corridos da ciência do ato", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      dataPublicacaoConhecida: "2026-03-03",
      atoChave: "ms-impetracao",
    });
    expect(r.contagem).toBe("corridos");
    expect(r.diasEfetivos).toBe(120);
    // ciência 03/03 -> início 04/03 (dia 1) -> dia 120 em 01/07/2026 (quarta, útil)
    expect(r.dataFatal).toBe("2026-07-01");
  });

  it("exige a data de ciência, porque não corre da publicação no diário", () => {
    expect(() =>
      calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "ms-impetracao" }),
    ).toThrow(/CIÊNCIA/);
  });
});

describe("dias corridos e a suspensão do art. 220", () => {
  it("SUSPENDE o curso do prazo no recesso quando o rito admite a suspensão", () => {
    // Ato cível (aplicaRecesso = true) com contagem sobreposta para corridos.
    // Disp 10/12/2026 (qui) -> publicação 11/12 (sex) -> início 12/12 (sáb, dia 1).
    // Conta 12 a 19/12 (8 dias), pula 20/12 a 20/01 (suspenso), retoma em 21/01/2027
    // até completar 15 -> fatal 27/01/2027 (quarta, útil).
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-12-10",
      atoChave: "contestacao",
      contagem: "corridos",
    });
    expect(r.dataFatal).toBe("2027-01-27");
    expect(r.memoria.some((m) => m.includes("não contados por recaírem na suspensão"))).toBe(true);
  });

  it("NÃO suspende quando o rito não admite (penal segue contínuo no recesso)", () => {
    // Mesma janela, rito penal: 10 dias corridos de 12/12 em diante, sem pausa -> 21/12/2026.
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-12-10",
      atoChave: "resposta-acusacao",
    });
    expect(r.dataFatal).toBe("2026-12-21");
  });

  it("empurra o início para depois do recesso quando a contagem começaria dentro dele", () => {
    // Ciência 28/12/2026 (dentro do recesso) -> início seria 29/12, suspenso;
    // contagem começa em 21/01/2027 (dia 1) e 5 dias corridos -> 25/01/2027 (segunda).
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-12-28",
      dataPublicacaoConhecida: "2026-12-28",
      atoChave: "manifestacao-generica",
      contagem: "corridos",
    });
    expect(r.dataInicioContagem).toBe("2027-01-21");
    expect(r.dataFatal).toBe("2027-01-25");
  });
});

describe("divergência do prazo em relação ao catálogo", () => {
  it("aceita dias fixados pelo juiz, mas alerta a divergência com o prazo legal", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      atoChave: "contestacao",
      dias: 30,
    });
    expect(r.diasEfetivos).toBe(30);
    expect(r.alertas.some((a) => a.includes("diverge do prazo legal"))).toBe(true);
  });

  it("rejeita chave inexistente em vez de adivinhar", () => {
    expect(() =>
      calcularPrazo({ dataDisponibilizacao: "2026-03-03", atoChave: "ato-que-nao-existe" }),
    ).toThrow(/não existe no catálogo/);
  });
});
