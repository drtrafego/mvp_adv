import { describe, it, expect } from "vitest";
import { normalizarNome, papelDoPolo, classificarPartes } from "./partes.js";

describe("normalizarNome", () => {
  it("tira acento e sobe para maiúsculas", () => {
    expect(normalizarNome("José Antônio da Conceição")).toBe("JOSE ANTONIO DA CONCEICAO");
  });

  it("colapsa espaços e pontuação", () => {
    expect(normalizarNome("  FRANCA , FRANCA  &  ARAUJO   ADVOGADOS  ")).toBe(
      "FRANCA FRANCA E ARAUJO ADVOGADOS",
    );
  });

  it("padroniza sufixo societário: acento e forma extensa dão a mesma chave", () => {
    const chave = normalizarNome("Construções Alfa Ltda.");
    expect(chave).toBe("CONSTRUCOES ALFA LTDA");
    expect(normalizarNome("CONSTRUCOES ALFA LIMITADA")).toBe(chave);
    expect(normalizarNome("construções alfa   ltda")).toBe(chave);
  });

  it("iguala S/A, S.A. e sociedade anônima", () => {
    const chave = normalizarNome("Banco Beta S/A");
    expect(chave).toBe("BANCO BETA SA");
    expect(normalizarNome("BANCO BETA S.A.")).toBe(chave);
    expect(normalizarNome("Banco Beta Sociedade Anônima")).toBe(chave);
  });

  it("iguala ME escrito de formas diferentes", () => {
    expect(normalizarNome("TEKA COMERCIO DE CEREAIS LTDA - ME")).toBe(
      normalizarNome("Teka Comércio de Cereais Limitada Microempresa"),
    );
  });

  it("nome vazio vira chave vazia, sem estourar", () => {
    expect(normalizarNome("")).toBe("");
    expect(normalizarNome("   ")).toBe("");
  });
});

describe("papelDoPolo", () => {
  it("traduz o polo do DJEN sem afirmar o rito", () => {
    expect(papelDoPolo("A")).toBe("polo ativo");
    expect(papelDoPolo("p")).toBe("polo passivo");
    expect(papelDoPolo(null)).toBe("parte");
  });
});

describe("classificarPartes — confiança", () => {
  it("polo único em todas as intimações vira confiança alta e sugestão de cliente", () => {
    const r = classificarPartes([
      { nome: "F. S. M. R.", polo: "A", comunicacaoId: "c1" },
      { nome: "G. A. R.", polo: "A", comunicacaoId: "c2" },
    ]);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.confianca === "alta")).toBe(true);
    expect(r.every((x) => x.eClienteSugerido)).toBe(true);
    expect(r[0].papelSugerido).toBe("polo ativo");
  });

  it("destinatários dos dois polos derrubam tudo para baixa, sem sugerir cliente", () => {
    const r = classificarPartes([
      { nome: "AGENIR MARIA DOS SANTOS CARVALHO", polo: "P" },
      { nome: "FERNANDA FRAGA DE MELO", polo: "A" },
    ]);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.confianca === "baixa")).toBe(true);
    expect(r.some((x) => x.eClienteSugerido)).toBe(false);
    expect(r[0].justificativa).toContain("dois polos");
  });

  it("destinatário sem polo não conta como polo único", () => {
    const r = classificarPartes([
      { nome: "ALFA LTDA", polo: "A" },
      { nome: "BETA LTDA", polo: null },
    ]);
    expect(r.every((x) => x.confianca === "baixa")).toBe(true);
    expect(r.some((x) => x.eClienteSugerido)).toBe(false);
  });

  it("nome já confirmado pelo advogado sobe um degrau, mas polo ambíguo nunca vira alta", () => {
    const confirmados = new Map([["ALFA LTDA", ["1000000-00.2026.8.11.0041"]]]);
    const r = classificarPartes(
      [
        { nome: "Alfa Limitada", polo: "A" },
        { nome: "BETA LTDA", polo: "P" },
      ],
      { confirmadosPeloAdvogado: confirmados },
    );
    const alfa = r.find((x) => x.nomeChave === "ALFA LTDA");
    const beta = r.find((x) => x.nomeChave === "BETA LTDA");
    expect(alfa?.confianca).toBe("media");
    expect(alfa?.eClienteSugerido).toBe(false);
    expect(alfa?.justificativa).toContain("já confirmado pelo advogado");
    expect(beta?.confianca).toBe("baixa");
  });

  it("o mesmo nome em intimações diferentes entra uma vez só, com o nome original preservado", () => {
    const r = classificarPartes([
      { nome: "Construções Alfa Ltda.", polo: "P", comunicacaoId: "c1" },
      { nome: "CONSTRUCOES ALFA LIMITADA", polo: "P", comunicacaoId: "c2" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Construções Alfa Ltda.");
    expect(r[0].nomeChave).toBe("CONSTRUCOES ALFA LTDA");
    expect(r[0].confianca).toBe("alta");
  });

  it("o mesmo nome nos dois polos continua sendo duas linhas, para o advogado ver o conflito", () => {
    const r = classificarPartes([
      { nome: "ALFA LTDA", polo: "A" },
      { nome: "ALFA LTDA", polo: "P" },
    ]);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.confianca === "baixa")).toBe(true);
  });

  it("rótulo de segredo de justiça nunca vira sugestão de cliente", () => {
    const r = classificarPartes([{ nome: "SEGREDO", polo: "A" }]);
    expect(r).toHaveLength(1);
    expect(r[0].confianca).toBe("baixa");
    expect(r[0].eClienteSugerido).toBe(false);
    expect(r[0].justificativa).toContain("segredo de justiça");
  });

  it("polo único com um placeholder junto: o nome real é sugerido, o rótulo não", () => {
    const r = classificarPartes([
      { nome: "Alfa Ltda", polo: "P" },
      { nome: "Segredo", polo: "P" },
    ]);
    const alfa = r.find((x) => x.nomeChave === "ALFA LTDA");
    const segredo = r.find((x) => x.nomeChave === "SEGREDO");
    expect(alfa?.eClienteSugerido).toBe(true);
    expect(alfa?.confianca).toBe("alta");
    expect(segredo?.eClienteSugerido).toBe(false);
  });

  it("lista vazia não gera detecção", () => {
    expect(classificarPartes([])).toEqual([]);
    expect(classificarPartes([{ nome: "   ", polo: "A" }])).toEqual([]);
  });
});
