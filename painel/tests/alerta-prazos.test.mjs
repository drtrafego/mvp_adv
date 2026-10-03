import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as tempo from "../src/lib/prazo-ui.ts";
import { autorizarCron } from "../src/lib/seguranca.ts";

function carregar(caminho, mocks, globals = {}) {
  const codigo = ts.transpileModule(readFileSync(new URL(caminho, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(codigo, {
    exports, Request, Response, AbortSignal, Date, ...globals,
    require(id) {
      if (!(id in mocks)) throw new Error(`Dependência de teste ausente: ${id}`);
      return mocks[id];
    },
  });
  return exports;
}

function consultasComPrazos(rows, globals = {}) {
  // Executa os predicados da própria query sobre dados fictícios, sem conexão de banco.
  const schema = new Proxy({}, { get: (_, tabela) => new Proxy({}, { get: (_, coluna) => `${String(tabela)}.${String(coluna)}` }) });
  const valor = (row, coluna) => row[coluna.split(".").at(-1)];
  const orm = {
    sql: () => null,
    eq: (coluna, esperado) => (row) => valor(row, coluna) === esperado,
    ne: (coluna, esperado) => (row) => valor(row, coluna) !== esperado,
    gte: (coluna, esperado) => (row) => valor(row, coluna) >= esperado,
    lte: (coluna, esperado) => (row) => valor(row, coluna) <= esperado,
    and: (...condicoes) => (row) => condicoes.every((condicao) => condicao(row)),
  };
  const db = {
    select() {
      return {
        from() { return this; },
        leftJoin() { return this; },
        where(predicado) { this.predicado = predicado; return this; },
        async orderBy() { return rows.filter(this.predicado); },
      };
    },
  };
  return carregar("../src/db/queries.ts", {
    "server-only": {}, "drizzle-orm": orm, "./index": { db, schema }, "../lib/prazo-ui": tempo,
  }, globals);
}

test("alerta mantém o prazo de hoje em Cuiabá depois da meia-noite UTC e exclui o dia extra", async () => {
  class Relogio extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-10-03T00:30:00Z"])); }
  }
  const consultas = consultasComPrazos([
    { dataFatal: "2026-10-01", status: "confirmado", ato: "Vencido" },
    { dataFatal: "2026-10-02", status: "confirmado", ato: "Vence hoje" },
    { dataFatal: "2026-10-05", status: "sugerido", ato: "Último dia da janela" },
    { dataFatal: "2026-10-06", status: "confirmado", ato: "Fora da janela" },
    { dataFatal: "2026-10-02", status: "cancelado", ato: "Cancelado" },
  ], { Date: Relogio });
  const rows = await consultas.prazosVencendo(3, new Date("2026-10-03T00:30:00Z"));
  assert.deepEqual(rows.map((row) => row.ato), ["Vence hoje", "Último dia da janela"]);
});

function cronComEntrega(fetchTeste, webhook = "https://canal-ficticio.test/webhook") {
  return carregar("../src/app/api/cron/alertar-prazos/route.ts", {
    "@/lib/seguranca": { autorizarCron }, "@/lib/prazo-ui": tempo,
    "@/db/queries": {
      prazosVencendo: async () => [{ dataFatal: "2026-10-03", ato: "Prazo fictício", origem: "humana" }],
      saudeColeta: async () => [], diasSemIntimacaoNova: async () => null,
    },
  }, { process: { env: { CRON_SECRET: "segredo-teste", ...(webhook ? { ALERTA_WEBHOOK_URL: webhook } : {}) } }, fetch: fetchTeste });
}

const requestCron = () => new Request("https://gabinete.test/api/cron/alertar-prazos", { headers: { authorization: "Bearer segredo-teste" } });

test("cron retorna HTTP 502 e ok=false se o destino recusar o alerta", async () => {
  let envios = 0;
  const cron = cronComEntrega(async () => { envios++; return new Response("erro fictício", { status: 500 }); });
  const response = await cron.GET(requestCron());
  const resultado = await response.json();
  assert.equal(response.status, 502);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.enviado, false);
  assert.equal(resultado.estadoEntrega, "falhou");
  assert.equal(envios, 1);
});

test("cron sinaliza timeout como entrega incerta, sem repetir o envio", async () => {
  let envios = 0;
  const cron = cronComEntrega(async () => { envios++; throw new DOMException("timeout fictício", "TimeoutError"); });
  const response = await cron.GET(requestCron());
  const resultado = await response.json();
  assert.equal(response.status, 504);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.enviado, false);
  assert.equal(resultado.estadoEntrega, "incerto");
  assert.equal(envios, 1);
});

test("cron retorna HTTP 502 quando fetch falha", async () => {
  const cron = cronComEntrega(async () => { throw new TypeError("Falha de transporte fictícia"); });
  const response = await cron.GET(requestCron());
  const resultado = await response.json();
  assert.equal(response.status, 502);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.estadoEntrega, "falhou");
});

test("cron confirma sucesso somente quando o destino aceita o alerta", async () => {
  let envios = 0;
  const cron = cronComEntrega(async (_url, options) => {
    envios++;
    assert.match(JSON.parse(options.body).text, /Prazo fictício/);
    return new Response(null, { status: 204 });
  });
  const response = await cron.GET(requestCron());
  const resultado = await response.json();
  assert.equal(response.status, 200);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.enviado, true);
  assert.equal(resultado.estadoEntrega, "enviado");
  assert.equal(envios, 1);
});

test("cron sem webhook permanece uma prévia e não chama rede", async () => {
  const preview = cronComEntrega(() => { throw new Error("Não deve enviar sem destino"); }, "");
  const response = await preview.GET(requestCron());
  const resultado = await response.json();
  assert.equal(response.status, 200);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.enviado, false);
  assert.equal(resultado.estadoEntrega, "nao_configurado");
});

test("janela civil acompanha a meia-noite local e as viradas de mês/ano", () => {
  assert.deepEqual(tempo.janelaPrazos(3, new Date("2026-10-03T03:59:59Z")), { hoje: "2026-10-02", limite: "2026-10-05" });
  assert.deepEqual(tempo.janelaPrazos(3, new Date("2026-10-03T04:00:00Z")), { hoje: "2026-10-03", limite: "2026-10-06" });
  assert.deepEqual(tempo.janelaPrazos(3, new Date("2027-01-01T00:30:00Z")), { hoje: "2026-12-31", limite: "2027-01-03" });
});

test("cron consulta e anuncia a mesma janela mesmo se o relógio cruzar a meia-noite local durante a leitura", async () => {
  let instantesLidos = 0;
  class Relogio extends Date {
    constructor(...args) {
      super(...(args.length ? args : [instantesLidos++ === 0 ? "2026-10-03T03:59:59Z" : "2026-10-03T04:00:01Z"]));
    }
  }
  const consultas = consultasComPrazos([
    { dataFatal: "2026-10-02", status: "confirmado", ato: "Hoje", origem: "humana" },
    { dataFatal: "2026-10-05", status: "confirmado", ato: "Limite", origem: "humana" },
    { dataFatal: "2026-10-06", status: "confirmado", ato: "Fora", origem: "humana" },
  ]);
  let snapshot;
  const cron = carregar("../src/app/api/cron/alertar-prazos/route.ts", {
    "@/lib/seguranca": { autorizarCron }, "@/lib/prazo-ui": tempo,
    "@/db/queries": {
      async prazosVencendo(dias, agora) {
        snapshot = agora;
        return consultas.prazosVencendo(dias, agora);
      },
      saudeColeta: async () => [], diasSemIntimacaoNova: async () => null,
    },
  }, { Date: Relogio, process: { env: { CRON_SECRET: "segredo-teste", ALERTA_DIAS: "3" } }, fetch() { throw new Error("Nenhuma rede é permitida neste teste"); } });
  const resposta = await cron.GET(new Request("https://gabinete.test/api/cron/alertar-prazos", { headers: { authorization: "Bearer segredo-teste" } }));
  const resultado = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(resultado.prazos, 2);
  assert.equal(resultado.ate, "2026-10-05");
  assert.equal(snapshot.toISOString(), "2026-10-03T03:59:59.000Z");
  assert.equal(instantesLidos, 1, "O request inteiro usa um único instante civil para consulta e rótulo");
});
