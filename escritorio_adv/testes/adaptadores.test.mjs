import test from "node:test";
import assert from "node:assert/strict";
import { gerarProcuracao } from "../adaptadores/procuracao-generator.ts";
import { ZapSignAdapter } from "../adaptadores/zapsign-adapter.ts";

test("gerarProcuracao rejeita dados incompletos sem chutar valores", () => {
  assert.throws(
    () =>
      gerarProcuracao({
        outorgante: { nome: "", cpf: "", endereco: "" },
      }),
    /Dados incompletos para geração de procuração/
  );

  assert.throws(
    () =>
      gerarProcuracao({
        outorgante: { nome: "João Silva", cpf: "", endereco: "Rua A, 123" },
      }),
    /CPF do outorgante/
  );
});

test("gerarProcuracao gera documento defensável com Daniel Felix e poderes especiais", () => {
  const doc = gerarProcuracao({
    outorgante: {
      nome: "Carlos Eduardo Santos",
      nacionalidade: "brasileiro",
      estadoCivil: "casado",
      profissao: "engenheiro",
      cpf: "123.456.789-00",
      rg: "12.345.678-9",
      orgaoExpedidor: "SSP/SP",
      endereco: "Av. Paulista, 1000, apto 42, Bela Vista, São Paulo/SP",
      email: "carlos@exemplo.com",
      telefone: "(11) 98765-4321",
    },
    advogado: {
      nome: "DANIEL FELIX",
      oabNumero: "123.456",
      oabUf: "SP",
    },
    poderesEspeciais: {
      receberEDarQuitacao: true,
      transigirEAcordar: true,
      levantarValoresRpvPrecatorio: true,
      substabelecerComReserva: true,
    },
    finalidadeEspecifica: "Ação de Cobrança em face de Construtora XYZ",
  });

  assert.equal(doc.versao, 1);
  assert.equal(doc.advogadoResponsavel.nome, "DANIEL FELIX");
  assert.match(doc.html, /DANIEL FELIX/);
  assert.match(doc.html, /OAB\/SP 123\.456/);
  assert.match(doc.html, /receber e dar quitação/);
  assert.match(doc.html, /levantar alvarás judiciais, RPVs e precatórios/);
  assert.match(doc.html, /Ação de Cobrança em face de Construtora XYZ/);
  assert.equal(typeof doc.sha256, "string");
  assert.equal(doc.sha256.length, 64);
});

test("ZapSignAdapter normaliza criação de documento e webhooks com idempotência", async () => {
  let requestSent;
  const mockFetcher = async (url, options) => {
    requestSent = { url, options };
    return {
      ok: true,
      json: async () => ({
        token: "tok_doc_test_123",
        name: "Procuração Teste",
        status: "pending",
        signers: [
          { name: "Carlos", email: "carlos@exemplo.com", sign_url: "https://zapsign.co/sign/1" },
        ],
      }),
    };
  };

  const adapter = new ZapSignAdapter({
    apiToken: "secret_test_token",
    fetcher: mockFetcher,
  });

  const res = await adapter.createDocument({
    idempotencyKey: "idem_123",
    documentName: "Procuração Teste",
    pdfUrl: "https://storage.local/doc.pdf",
    signers: [{ nome: "Carlos", email: "carlos@exemplo.com", cpf: "12345678900" }],
  });

  assert.equal(res.providerDocumentId, "tok_doc_test_123");
  assert.equal(res.signUrls[0].signUrl, "https://zapsign.co/sign/1");
  assert.match(requestSent.options.headers.Authorization, /Bearer secret_test_token/);

  // Test webhook normalization
  const webhookBody = {
    event_type: "doc_signed",
    token: "tok_doc_test_123",
    status: "signed",
    signers: [{ name: "Carlos", status: "signed" }],
    signed_file: "https://zapsign.co/files/tok_doc_test_123_signed.pdf",
  };

  const event = await adapter.normalizeWebhook({}, webhookBody);
  assert.equal(event.provider, "zapsign");
  assert.equal(event.eventType, "doc_completed");
  assert.equal(event.isFullySigned, true);
  assert.equal(event.providerDocumentId, "tok_doc_test_123");
  assert.equal(typeof event.rawPayloadHash, "string");
  assert.equal(event.rawPayloadHash.length, 64);
});
