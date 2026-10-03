import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarIntimacoes, ComunicaError } from "./comunica.js";

afterEach(() => vi.unstubAllGlobals());

const params = { numeroOab: "11158", ufOab: "MT", itensPorPagina: 2 };
const item = (hash: string) => ({ hash, texto: `Intimação ${hash}`, numero_processo: "processo" });
const resposta = (...hashes: string[]) => new Response(JSON.stringify({ items: hashes.map(item) }), {
  status: 200, headers: { "content-type": "application/json" },
});

describe("coleta DJEN completa e falhas visíveis", () => {
  it("busca as páginas seguintes, sem parar nos primeiros 100 itens", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resposta("a", "b"))
      .mockResolvedValueOnce(resposta("c"));
    vi.stubGlobal("fetch", fetchMock);
    expect((await buscarIntimacoes(params, 1)).map((c) => c.hash)).toEqual(["a", "b", "c"]);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("pagina")).toBe("2");
  });

  it("faz mais uma consulta quando a última página tem o tamanho exato", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resposta("a", "b")).mockResolvedValueOnce(resposta());
    vi.stubGlobal("fetch", fetchMock);
    expect(await buscarIntimacoes(params, 1)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserva dados parciais e informa falha em página posterior", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resposta("a", "b"))
      .mockResolvedValueOnce(new Response("erro", { status: 400 })));
    const erro = await buscarIntimacoes(params, 1).catch((e) => e);
    expect(erro).toBeInstanceOf(ComunicaError);
    expect(erro.coletaParcial).toBe(true);
    expect(erro.itensParciais.map((c: { hash: string }) => c.hash)).toEqual(["a", "b"]);
  });

  it("não esconde falha na OAB com letra quando a versão só dígitos responde", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("erro", { status: 400 }))
      .mockResolvedValueOnce(resposta("federal")));
    const erro = await buscarIntimacoes({ ...params, letraOab: "B" }, 1).catch((e) => e);
    expect(erro).toBeInstanceOf(ComunicaError);
    expect(erro.message).toContain("11158-B");
    expect(erro.coletaParcial).toBe(true);
    expect(erro.itensParciais).toHaveLength(1);
  });

  it("detecta API que ignora paginação e repete a primeira página", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(resposta("a", "b"))));
    await expect(buscarIntimacoes(params, 1)).rejects.toThrow(/repetiu dados/);
  });

  it("resposta malformada não vira nenhuma intimação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))));
    await expect(buscarIntimacoes(params, 1)).rejects.toThrow(/sem a lista items/);
  });
});
