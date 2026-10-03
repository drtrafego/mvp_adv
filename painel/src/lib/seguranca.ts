import { timingSafeEqual } from "node:crypto";

/** Validação de fronteira: argumentos de actions e rotas não são tipados em runtime. */
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

export function ehDataIso(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function ehHashSha256(valor: unknown): valor is string {
  return typeof valor === "string" && /^[a-f0-9]{64}$/.test(valor);
}

export function textoValido(valor: unknown, maximo: number, obrigatorio = true): valor is string {
  return typeof valor === "string" && valor.length <= maximo && (!obrigatorio || valor.trim().length > 0);
}

/** Cron nunca pode funcionar sem segredo, inclusive em desenvolvimento. */
export function autorizarCron(header: string | null, segredo: string | undefined): boolean {
  if (!segredo || !header) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(header);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** Requisições de mutação do browser devem vir da própria origem. Webhooks são verificados pelo SDK. */
export function origemPermitida(request: Request): boolean {
  const origem = request.headers.get("origin");
  if (!origem) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origem).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function nomeDownload(valor: string | null): string {
  return (valor ?? "documento").replace(/[\r\n\x00-\x1f\x7f"\\/]/g, "_").slice(0, 180) || "documento";
}
