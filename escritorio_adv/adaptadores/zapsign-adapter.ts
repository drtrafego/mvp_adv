/**
 * Adaptador para a API do ZapSign.
 * Documentação de referência: https://docs.zapsign.com.br/
 */
import { createHash } from "node:crypto";
import type {
  SignatureProvider,
  SignerRef,
  CreateSignatureRequestParams,
  DocumentSignatureStatus,
  NormalizedWebhookEvent,
} from "./signature-provider";

export interface ZapSignConfig {
  apiToken: string;
  baseUrl?: string;
  webhookSecret?: string;
  fetcher?: typeof fetch;
}

export class ZapSignAdapter implements SignatureProvider {
  private apiToken: string;
  private baseUrl: string;
  private webhookSecret?: string;
  private fetcher: typeof fetch;

  constructor(config: ZapSignConfig) {
    if (!config.apiToken) throw new Error("ZapSign apiToken é obrigatório.");
    this.apiToken = config.apiToken;
    this.baseUrl = (config.baseUrl || "https://api.zapsign.com.br").replace(/\/$/, "");
    this.webhookSecret = config.webhookSecret;
    this.fetcher = config.fetcher || fetch;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiToken}`,
      ...(options.headers || {}),
    };
    const res = await this.fetcher(url, { ...options, headers });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`ZapSign API erro [${res.status}]: ${errBody}`);
    }
    return res.json() as Promise<T>;
  }

  async createDocument(params: CreateSignatureRequestParams): Promise<{
    providerDocumentId: string;
    signUrls: Array<{ signer: SignerRef; signUrl: string }>;
  }> {
    const payload = {
      name: params.documentName,
      url_pdf: params.pdfUrl,
      base64_pdf: params.pdfBase64,
      external_id: params.externalId,
      signers: params.signers.map((s) => ({
        name: s.nome,
        email: s.email,
        phone_number: s.telefone,
        require_cpf: Boolean(s.cpf),
        cpf: s.cpf?.replace(/\D/g, ""),
      })),
      lang: "pt-br",
      brand_logo: params.metadata?.brandLogo,
    };

    const data = await this.request<any>("/api/v1/docs/", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const token = data.token || data.id;
    const signersResp = Array.isArray(data.signers) ? data.signers : [];

    const signUrls = params.signers.map((origSigner, index) => {
      const respSigner = signersResp[index] || {};
      return {
        signer: origSigner,
        signUrl: respSigner.sign_url || "",
      };
    });

    return {
      providerDocumentId: token,
      signUrls,
    };
  }

  async getDocumentStatus(providerDocumentId: string): Promise<DocumentSignatureStatus> {
    const data = await this.request<any>(`/api/v1/docs/${providerDocumentId}/`);

    const signers = (data.signers || []).map((s: any) => ({
      nome: s.name,
      email: s.email,
      telefone: s.phone_number,
      status: s.status === "signed" ? ("signed" as const) : ("pending" as const),
      signedAt: s.signed_at,
    }));

    const allSigned = signers.length > 0 && signers.every((s: any) => s.status === "signed");
    const statusMap: Record<string, DocumentSignatureStatus["status"]> = {
      signed: "signed",
      pending: "pending",
      canceled: "cancelled",
      rejected: "rejected",
    };

    return {
      providerDocumentId: data.token || providerDocumentId,
      status: allSigned ? "signed" : statusMap[data.status] || "pending",
      originalName: data.name,
      signedFileUrl: data.signed_file,
      signers,
      createdAt: data.created_at,
      completedAt: allSigned ? data.last_update : undefined,
    };
  }

  async downloadCompletedDocument(providerDocumentId: string): Promise<{
    buffer: Buffer;
    sha256: string;
  }> {
    const status = await this.getDocumentStatus(providerDocumentId);
    if (!status.signedFileUrl) {
      throw new Error(`Documento ${providerDocumentId} ainda não possui arquivo final assinado.`);
    }

    const res = await this.fetcher(status.signedFileUrl);
    if (!res.ok) {
      throw new Error(`Falha ao baixar PDF assinado do ZapSign [${res.status}].`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    return { buffer, sha256 };
  }

  async normalizeWebhook(
    headers: Record<string, string>,
    rawBody: string | object
  ): Promise<NormalizedWebhookEvent> {
    const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    const payloadHash = createHash("sha256").update(bodyStr).digest("hex");
    const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

    // Se configurado segredo de webhook, validar header de autenticação
    if (this.webhookSecret) {
      const authHeader = headers["authorization"] || headers["x-api-token"] || headers["x-webhook-secret"];
      if (authHeader && authHeader !== this.webhookSecret && authHeader !== `Bearer ${this.webhookSecret}`) {
        throw new Error("Webhook ZapSign: assinatura/token inválido.");
      }
    }

    const event = payload.event_type || payload.type || "doc_updated";
    const docToken = payload.token || payload.doc_token || payload.id;
    const signers = payload.signers || [];
    const isFullySigned = payload.status === "signed" || (signers.length > 0 && signers.every((s: any) => s.status === "signed"));

    let eventType: NormalizedWebhookEvent["eventType"] = "doc_created";
    if (event === "doc_signed") eventType = isFullySigned ? "doc_completed" : "doc_signed";
    else if (event === "doc_completed" || isFullySigned) eventType = "doc_completed";
    else if (event === "doc_rejected") eventType = "doc_rejected";
    else if (event === "doc_canceled" || event === "doc_cancelled") eventType = "doc_cancelled";

    return {
      provider: "zapsign",
      eventType,
      providerDocumentId: docToken,
      externalId: payload.external_id,
      signerEmail: payload.signer?.email,
      signerPhone: payload.signer?.phone_number,
      isFullySigned,
      signedFileUrl: payload.signed_file,
      rawPayloadHash: payloadHash,
      timestamp: new Date().toISOString(),
    };
  }
}
