import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { ehHashSha256, ehUuid } from "../src/lib/seguranca.ts";

const id = "12345678-1234-4321-8123-123456789abc";
const inicial = { id, conteudo: "Texto revisado pelo advogado: ç, ação e 😀.", versao: 1, origem: "maquina", status: "gerado" };
const hash = (conteudo) => createHash("sha256").update(conteudo, "utf8").digest("hex");
const snapshot = (peca) => ({ hashConteudo: hash(peca.conteudo), versao: peca.versao, origem: peca.origem });

/** Simula um outro escritor entre SELECT e UPDATE, avaliando o predicado ao efetivar a escrita. */
function preparar({ estado = { ...inicial }, antesDoUpdate, autenticado = true } = {}) {
  let atualizacoes = 0;
  let revalidacoes = 0;
  const peca = { ...estado };
  const colunas = Object.fromEntries(Object.keys(inicial).map((chave) => [chave, chave]));
  const banco = {
    select(selecao) {
      const consulta = {
        from() { return consulta; },
        where(predicado) { consulta.predicado = predicado; return consulta; },
        async limit() {
          return consulta.predicado(peca) ? [Object.fromEntries(Object.entries(selecao).map(([alias, coluna]) => [alias, peca[coluna]]))] : [];
        },
      };
      return consulta;
    },
    update() {
      atualizacoes++;
      const consulta = {
        set(dados) { consulta.dados = dados; return consulta; },
        where(predicado) { consulta.predicado = predicado; return consulta; },
        async returning() {
          antesDoUpdate?.(peca);
          if (!consulta.predicado(peca)) return [];
          Object.assign(peca, consulta.dados);
          return [{ id: peca.id }];
        },
      };
      return consulta;
    },
  };
  const mocks = {
    "next/cache": { revalidatePath() { revalidacoes++; } },
    "node:crypto": { createHash },
    "drizzle-orm": {
      and: (...predicados) => (linha) => predicados.every((predicado) => predicado(linha)),
      eq: (coluna, valor) => (linha) => linha[coluna] === valor,
      inArray: (coluna, valores) => (linha) => valores.includes(linha[coluna]),
      isNull: (coluna) => (linha) => linha[coluna] == null,
    },
    "@/db": { db: banco, schema: { pecas: colunas } },
    "@/lib/auth": { getUsuarioAtual: async () => autenticado ? { id: "titular", email: "advogado@example.test" } : null },
    "@/lib/seguranca": { ehUuid, ehHashSha256 },
    "@/lib/partes": {},
  };
  const fonte = readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(codigo, { exports, require: (nome) => {
    if (!(nome in mocks)) throw new Error(`Mock ausente: ${nome}`);
    return mocks[nome];
  }, Date, Buffer, process, console });
  return { aprovar: exports.confirmarPecaAction, peca, contagens: () => ({ atualizacoes, revalidacoes }) };
}

test("aprova o texto exibido e registra o autor da sessão", async () => {
  const caso = preparar();
  const resultado = await caso.aprovar(id, snapshot(inicial));
  assert.equal(resultado.ok, true);
  assert.equal(caso.peca.origem, "humana");
  assert.equal(caso.peca.conteudo, inicial.conteudo);
  assert.equal(caso.peca.editadoPor, "advogado@example.test (titular)");
  assert.deepEqual(caso.contagens(), { atualizacoes: 1, revalidacoes: 1 });
});

test("rejeita a revisão de texto antigo, mesmo se o agente não incrementou a versão", async () => {
  const caso = preparar({ estado: { ...inicial, conteudo: "Nova redação ainda não lida" } });
  const resultado = await caso.aprovar(id, snapshot(inicial));
  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /mudou desde sua leitura/);
  assert.equal(caso.peca.origem, "maquina");
  assert.equal(caso.contagens().atualizacoes, 0);
});

test("rejeita redação alterada entre a conferência e o UPDATE", async () => {
  const caso = preparar({ antesDoUpdate: (peca) => { peca.conteudo = "Texto concorrente não revisado"; } });
  const resultado = await caso.aprovar(id, snapshot(inicial));
  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /mudou durante a confirmação/);
  assert.equal(caso.peca.origem, "maquina");
  assert.equal(caso.peca.conteudo, "Texto concorrente não revisado");
  assert.equal(caso.contagens().revalidacoes, 0);
});

test("versão nova e arquivamento concorrente invalidam a aprovação", async () => {
  for (const alterar of [(peca) => { peca.versao++; }, (peca) => { peca.status = "arquivado"; }]) {
    const caso = preparar({ antesDoUpdate: alterar });
    assert.equal((await caso.aprovar(id, snapshot(inicial))).ok, false);
    assert.equal(caso.peca.origem, "maquina");
  }
});

test("não sobrescreve a autoria de uma aprovação humana concorrente", async () => {
  const caso = preparar({ antesDoUpdate: (peca) => { peca.origem = "humana"; peca.editadoPor = "outro-advogado"; } });
  assert.equal((await caso.aprovar(id, snapshot(inicial))).ok, false);
  assert.equal(caso.peca.editadoPor, "outro-advogado");
});

test("exige sessão antes de consultar ou validar o snapshot", async () => {
  const caso = preparar({ autenticado: false });
  const resultado = await caso.aprovar(undefined, undefined);
  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /Sessão expirada/);
  assert.equal(caso.contagens().atualizacoes, 0);
});
