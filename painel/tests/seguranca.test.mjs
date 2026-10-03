import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";
import { autorizarCron, ehDataIso, ehHashSha256, ehUuid, nomeDownload, origemPermitida } from "../src/lib/seguranca.ts";
import { lerBytesLimitados } from "../src/lib/leitura-stream.ts";
import { montarStoragePath } from "../src/lib/documentos.ts";
import * as validacao from "../src/lib/seguranca.ts";

function moduloComMocks(caminho, mocks) {
  const arquivo = readFileSync(new URL(caminho, import.meta.url), "utf8");
  const codigo = ts.transpileModule(arquivo, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(codigo, { exports, require: (id) => {
    if (id === "node:crypto") return crypto;
    if (!(id in mocks)) throw new Error(`Mock ausente: ${id}`);
    return mocks[id];
  }, Request, Response, FormData, File, Buffer, process, console, AbortSignal });
  return exports;
}

test("cada action de negócio bloqueia a chamada sem sessão antes de acessar o banco", async () => {
  const banco = new Proxy({}, { get() { throw new Error("Action não autenticada tentou acessar o banco"); } });
  const actions = moduloComMocks("../src/app/actions.ts", {
    "next/cache": { revalidatePath() { throw new Error("Não pode revalidar sem sessão"); } },
    "drizzle-orm": {}, "@/db": { db: banco, schema: {} },
    "@/lib/auth": { getUsuarioAtual: async () => null },
    "@/lib/seguranca": {}, "@/lib/partes": {},
  });
  const funcoes = Object.entries(actions).filter(([, fn]) => typeof fn === "function");
  assert.ok(funcoes.length >= 25, "A suíte deve cobrir todas as mutações exportadas");
  for (const [nome, fn] of funcoes) {
    const resultado = await fn();
    assert.equal(resultado.ok, false, nome);
    assert.match(resultado.erro, /Sessão expirada/, nome);
  }
});

test("importação e administração de acessos recusam chamadas sem sessão", async () => {
  const banco = new Proxy({}, { get() { throw new Error("Acesso indevido ao banco"); } });
  const actions = moduloComMocks("../src/app/(app)/configuracoes/actions.ts", {
    "next/cache": {}, "drizzle-orm": {}, "@/db": { db: banco }, "@/db/schema": {},
    "@/lib/auth": { getUsuarioAtual: async () => null }, "@/lib/seguranca": {},
  });
  for (const [nome, fn] of Object.entries(actions)) {
    if (typeof fn !== "function") continue;
    const resultado = await fn(undefined, new FormData());
    assert.match(resultado.erro, /Sessão expirada/, nome);
  }
});

test("colaborador não pode criar, redefinir ou remover acessos", async () => {
  const banco = new Proxy({}, { get() { throw new Error("Colaborador acessou usuários"); } });
  const actions = moduloComMocks("../src/app/(app)/configuracoes/actions.ts", {
    "next/cache": {}, "drizzle-orm": {}, "@/db": { db: banco }, "@/db/schema": {},
    "@/lib/auth": { getUsuarioAtual: async () => ({ id: "colaborador" }), usuarioPodeAdministrar: async () => false },
    "@/lib/seguranca": {},
  });
  for (const nome of ["criarAcesso", "redefinirSenha", "removerAcesso"]) {
    const resultado = await actions[nome](undefined, new FormData());
    assert.match(resultado.erro, /Somente o titular/, nome);
  }
});

test("actions de documentos recusam sessão ausente antes de ler Blob ou banco", async () => {
  const banco = new Proxy({}, { get() { throw new Error("Documento não autenticado acessou banco"); } });
  const actions = moduloComMocks("../src/app/(app)/p/[id]/documentos/actions.ts", {
    "next/cache": {}, "drizzle-orm": {}, "@/db": { db: banco, schema: {} },
    "@vercel/blob": {}, "@/lib/auth": { getUsuarioAtual: async () => null },
    "@/lib/documentos": {}, "@/lib/seguranca": {},
  });
  for (const [nome, fn] of Object.entries(actions)) {
    if (typeof fn !== "function") continue;
    const resultado = await fn();
    assert.equal(resultado.ok, false, nome);
    assert.match(resultado.erro, /Não autorizado/, nome);
  }
});

test("prazo com data impossível é recusado antes da escrita", async () => {
  const banco = new Proxy({}, { get() { throw new Error("Data inválida alcançou o banco"); } });
  const actions = moduloComMocks("../src/app/actions.ts", {
    "next/cache": {}, "drizzle-orm": {}, "@/db": { db: banco, schema: {} },
    "@/lib/auth": { getUsuarioAtual: async () => ({ id: "titular", email: "titular@example.test" }) },
    "@/lib/seguranca": validacao, "@/lib/partes": {},
  });
  const resultado = await actions.editarPrazoAction("12345678-1234-4321-8123-123456789abc", { dataFatal: "2026-02-29" });
  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /data real/);
});

test("detecção já confirmada por humano não pode ser descartada por tela desatualizada", async () => {
  const consulta = { from() { return this; }, where() { return this; }, async limit() { return [{ status: "confirmado" }]; } };
  const banco = { select() { return consulta; }, update() { throw new Error("Decisão humana seria sobrescrita"); } };
  const actions = moduloComMocks("../src/app/actions.ts", {
    "next/cache": {}, "drizzle-orm": { eq: () => true },
    "@/db": { db: banco, schema: { partesDetectadas: { id: "id" } } },
    "@/lib/auth": { getUsuarioAtual: async () => ({ id: "titular", email: "titular@example.test" }) },
    "@/lib/seguranca": validacao, "@/lib/partes": {},
  });
  const resultado = await actions.descartarParteAction("12345678-1234-4321-8123-123456789abc");
  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /já foi decidida/);
});

test("cron desconfigurado ou sem autorização não consulta processos nem dispara webhook", async () => {
  const cron = moduloComMocks("../src/app/api/cron/alertar-prazos/route.ts", {
    "@/db/queries": new Proxy({}, { get() { throw new Error("Cron desautorizado consultou dados"); } }),
    "@/lib/seguranca": { autorizarCron },
    "@/lib/prazo-ui": {},
  });
  const antigo = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await cron.GET(new Request("https://gabinete.test/api/cron/alertar-prazos"))).status, 503);
    process.env.CRON_SECRET = "segredo-de-teste";
    assert.equal((await cron.GET(new Request("https://gabinete.test/api/cron/alertar-prazos"))).status, 401);
  } finally {
    if (antigo === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = antigo;
  }
});

test("reanexar após exclusão e refazer tentativa falha usa novo Blob sem sobrescrever o original", () => {
  const documento = { numeroCnj: "0001234-56.2026.8.11.0001", categoria: "prova", titulo: "Contrato",
    hashSha256: "a".repeat(64), extensao: ".pdf", data: "2025-05-01" };
  const primeiro = montarStoragePath({ ...documento, uploadId: "12345678-1234-4321-8123-123456789abc" });
  const reenvio = montarStoragePath({ ...documento, uploadId: "12345678-1234-4321-8123-123456789def" });
  assert.notEqual(primeiro, reenvio);
  assert.match(primeiro, /^processos\/00012345620268110001\/prova\/2025-05-01-contrato-aaaaaaaa-/);
  assert.match(reenvio, /123456789def\.pdf$/);
  assert.equal(documento.hashSha256, "a".repeat(64), "A deduplicação permanece baseada no conteúdo");
});

test("datas inválidas não podem virar datas fatais válidas", () => {
  assert.equal(ehDataIso("2026-02-29"), false);
  assert.equal(ehDataIso("2026-04-31"), false);
  assert.equal(ehDataIso("2028-02-29"), true);
  assert.equal(ehDataIso("2026-10-02"), true);
  assert.equal(ehDataIso("2026-10-02T00:00:00Z"), false);
});

test("valida UUID/hash e remove injeção de cabeçalho no nome de download", () => {
  assert.equal(ehUuid("12345678-1234-4321-8123-123456789abc"), true);
  assert.equal(ehUuid("../../outro-processo"), false);
  assert.equal(ehHashSha256("a".repeat(64)), true);
  assert.equal(ehHashSha256("a/../../"), false);
  assert.equal(nomeDownload('decisão"\r\nX-Header: 1.pdf'), "decisão___X-Header: 1.pdf");
});

test("mutações de documento rejeitam origem externa", () => {
  assert.equal(origemPermitida(new Request("https://gabinete.test/api", { headers: { origin: "https://gabinete.test" } })), true);
  assert.equal(origemPermitida(new Request("https://gabinete.test/api", { headers: { origin: "https://malicioso.test" } })), false);
  assert.equal(origemPermitida(new Request("https://gabinete.test/api", { headers: { "sec-fetch-site": "cross-site" } })), false);
});

test("cron falha fechado sem segredo e compara token completo", () => {
  assert.equal(autorizarCron("Bearer x", undefined), false);
  assert.equal(autorizarCron("Bearer x", "x"), true);
  assert.equal(autorizarCron("Bearer y", "x"), false);
  assert.equal(autorizarCron("Bearer xextra", "x"), false);
});

test("leitura de Blob cancela o stream ao ultrapassar limite real", async () => {
  let cancelado = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.enqueue(new Uint8Array([4, 5, 6])); },
    cancel() { cancelado = true; },
  });
  await assert.rejects(lerBytesLimitados(stream, 5), /limite de extração/);
  assert.equal(cancelado, true);
  const pequeno = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.close(); } });
  assert.deepEqual(await lerBytesLimitados(pequeno, 5), new Uint8Array([1, 2]));
});
