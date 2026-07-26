/**
 * Storage do binário dos documentos: Vercel Blob, privado.
 *
 * Por que Blob e não o disco do advogado: o painel roda na Vercel e precisa abrir o mesmo
 * arquivo que o terminal subiu. Caminho local (`C:\...`) no banco tornaria o documento invisível
 * para o painel e para qualquer outra máquina, e o backup morreria no HD.
 *
 * O acesso é `private`: a URL do blob não é pública nem adivinhável, e a leitura passa sempre
 * pela rota autenticada do painel. Documento de processo pode estar em segredo de justiça.
 */

import { put, del, type PutBlobResult } from "@vercel/blob";

export function blobConfigurado(): boolean {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  return Boolean(t) && !t!.startsWith("${");
}

function exigirToken(): string {
  if (!blobConfigurado()) {
    throw new Error(
      "Storage de documentos não configurado: defina BLOB_READ_WRITE_TOKEN em mcp-server/.env. " +
        "O token é criado ao conectar um Blob store ao projeto no painel da Vercel.",
    );
  }
  return process.env.BLOB_READ_WRITE_TOKEN as string;
}

/**
 * Envia o arquivo para o Blob no pathname exato da convenção (addRandomSuffix desligado: o
 * caminho já carrega o hash, e precisa ser reproduzível pelos dois lados, painel e terminal).
 */
export async function enviarParaBlob(
  pathname: string,
  corpo: Uint8Array,
  contentType: string,
): Promise<PutBlobResult> {
  return put(pathname, Buffer.from(corpo), {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: exigirToken(),
  });
}

/** Remove o binário. Só no "excluir definitivamente"; a exclusão normal é soft delete. */
export async function removerDoBlob(pathname: string): Promise<void> {
  await del(pathname, { token: exigirToken() });
}
