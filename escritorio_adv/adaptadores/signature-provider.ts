/**
 * Interface universal de provedor de assinatura digital/eletrônica.
 * Desacopla a aplicação do provedor específico (ZapSign, Autentique, etc.).
 */

export interface SignerRef {
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  papel?: "cliente" | "advogado" | "testemunha";
}

export interface CreateSignatureRequestParams {
  idempotencyKey: string;
  documentName: string;
  pdfBase64?: string;
  pdfUrl?: string;
  signers: SignerRef[];
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentSignatureStatus {
  providerDocumentId: string;
  status: "draft" | "pending" | "signed" | "rejected" | "cancelled" | "expired";
  originalName: string;
  signedFileUrl?: string;
  signers: Array<{
    nome: string;
    email?: string;
    telefone?: string;
    status: "pending" | "signed" | "rejected";
    signedAt?: string;
  }>;
  createdAt: string;
  completedAt?: string;
}

export interface NormalizedWebhookEvent {
  provider: "zapsign" | "autentique";
  eventType: "doc_created" | "doc_signed" | "doc_completed" | "doc_rejected" | "doc_cancelled";
  providerDocumentId: string;
  externalId?: string;
  signerEmail?: string;
  signerPhone?: string;
  isFullySigned: boolean;
  signedFileUrl?: string;
  rawPayloadHash: string;
  timestamp: string;
}

export interface SignatureProvider {
  createDocument(params: CreateSignatureRequestParams): Promise<{
    providerDocumentId: string;
    signUrls: Array<{ signer: SignerRef; signUrl: string }>;
  }>;

  getDocumentStatus(providerDocumentId: string): Promise<DocumentSignatureStatus>;

  downloadCompletedDocument(providerDocumentId: string): Promise<{
    buffer: Buffer;
    sha256: string;
  }>;

  normalizeWebhook(headers: Record<string, string>, rawBody: string | object): Promise<NormalizedWebhookEvent>;
}
