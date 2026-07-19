import { describe, it, expect } from "vitest";
import { parseOab, mesmaOab, ehDoAdvogado, canonicalOab, type IdentidadeOab } from "./oab.js";

// Os 6 formatos reais do Daniel no DJEN, todos a MESMA pessoa.
const FORMATOS_MT = ["11158-B/MT", "11158-A/MT", "11158/B/MT", "11158B/MT", "11158/MT", "11158B MT"];

describe("parseOab: os 6 formatos do Daniel convergem para número + UF", () => {
  it("todos os formatos de MT dão numero 11158 e uf MT", () => {
    for (const fmt of FORMATOS_MT) {
      const id = parseOab(fmt);
      expect(id, fmt).not.toBeNull();
      expect(id!.numero, fmt).toBe("11158");
      expect(id!.uf, fmt).toBe("MT");
    }
  });

  it("43972/SC dá numero 43972 e uf SC", () => {
    const id = parseOab("43972/SC");
    expect(id).toEqual<IdentidadeOab>({ numero: "43972", letra: null, uf: "SC" });
  });

  it("extrai a letra quando presente e null quando ausente", () => {
    expect(parseOab("11158-B/MT")!.letra).toBe("B");
    expect(parseOab("11158-A/MT")!.letra).toBe("A");
    expect(parseOab("11158/MT")!.letra).toBeNull();
  });
});

describe("mesmaOab: identidade por número + UF, ignorando a letra", () => {
  it("11158/MT e 11158-B/MT são a mesma pessoa", () => {
    expect(mesmaOab(parseOab("11158/MT")!, parseOab("11158-B/MT")!)).toBe(true);
  });

  it("todos os formatos de MT são mesmaOab entre si", () => {
    const base = parseOab("11158/MT")!;
    for (const fmt of FORMATOS_MT) {
      expect(mesmaOab(base, parseOab(fmt)!), fmt).toBe(true);
    }
  });

  it("11158/SC NÃO é 11158/MT (UF diferente)", () => {
    expect(mesmaOab(parseOab("11158/SC")!, parseOab("11158/MT")!)).toBe(false);
  });

  it("9999/MT NÃO é 11158/MT (número diferente)", () => {
    expect(mesmaOab(parseOab("9999/MT")!, parseOab("11158/MT")!)).toBe(false);
  });
});

describe("canonicalOab: descarta a letra", () => {
  it("normaliza qualquer formato para numero/UF", () => {
    expect(canonicalOab("11158-B/MT")).toBe("11158/MT");
    expect(canonicalOab("11158/MT")).toBe("11158/MT");
    expect(canonicalOab("43972/SC")).toBe("43972/SC");
    expect(canonicalOab("lixo sem oab")).toBeNull();
  });
});

describe("ehDoAdvogado: bate contra a lista de alvos", () => {
  const alvos = [parseOab("11158/MT")!, parseOab("43972/SC")!];

  it("aceita qualquer formato de MT do Daniel", () => {
    for (const fmt of FORMATOS_MT) {
      expect(ehDoAdvogado(fmt, alvos), fmt).toBe(true);
    }
  });

  it("aceita a seccional de SC", () => {
    expect(ehDoAdvogado("43972/SC", alvos)).toBe(true);
  });

  it("corta homônimo de UF diferente (11158/SC)", () => {
    expect(ehDoAdvogado("11158/SC", alvos)).toBe(false);
  });

  it("corta homônimo de número diferente (9999/MT)", () => {
    expect(ehDoAdvogado("9999/MT", alvos)).toBe(false);
  });
});

describe("parseOab: lixo retorna null", () => {
  it("string sem número + UF válida vira null", () => {
    expect(parseOab("")).toBeNull();
    expect(parseOab("DANIEL FRANCISCO FELIX")).toBeNull();
    expect(parseOab("11158")).toBeNull();
    expect(parseOab("///")).toBeNull();
  });
});
