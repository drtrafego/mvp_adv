/** Lê um Blob com teto real de bytes, mesmo se os metadados estiverem incorretos. */
export async function lerBytesLimitados(stream: ReadableStream<Uint8Array>, limite: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > limite) {
        await reader.cancel();
        throw new Error("Arquivo excede o limite de extração.");
      }
      partes.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(tamanho);
  let offset = 0;
  for (const parte of partes) {
    bytes.set(parte, offset);
    offset += parte.byteLength;
  }
  return bytes;
}
