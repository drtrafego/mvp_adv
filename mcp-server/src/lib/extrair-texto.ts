/**
 * Extração do texto do documento, para o squad forense poder LER a peça.
 *
 * Roda do lado que já tem o arquivo: no terminal é aqui (máquina do advogado, sem timeout de
 * função serverless). PDF escaneado não tem camada de texto e devolve `sem_texto`: nesse caso o
 * caminho é OCR (fora do MVP) ou abrir o arquivo local no Claude Code, que lê PDF direto.
 */

import { extractText, getDocumentProxy } from "unpdf";
import { TEXTO_MAX, MARCA_TRUNCADO } from "./documentos.js";

export type StatusExtracao = "ok" | "sem_texto" | "falhou" | "nao_aplica";

export interface ResultadoExtracao {
  texto: string | null;
  paginas: number | null;
  status: StatusExtracao;
  /** Motivo, quando falhou. Vai para o advogado, então em português. */
  motivo?: string;
}

function truncar(t: string): string {
  return t.length <= TEXTO_MAX ? t : t.slice(0, TEXTO_MAX) + MARCA_TRUNCADO;
}

export async function extrairTextoPdf(dados: Uint8Array): Promise<ResultadoExtracao> {
  try {
    const pdf = await getDocumentProxy(dados);
    // mergePages: true devolve o documento inteiro como uma string só.
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const texto = String(text).trim();
    if (!texto) {
      return {
        texto: null,
        paginas: totalPages ?? null,
        status: "sem_texto",
        motivo:
          "O PDF não tem camada de texto (provavelmente digitalizado). Precisa de OCR, ou abra o " +
          "arquivo local no Claude Code para leitura.",
      };
    }
    return { texto: truncar(texto), paginas: totalPages ?? null, status: "ok" };
  } catch (e) {
    return {
      texto: null,
      paginas: null,
      status: "falhou",
      motivo: `Falha ao ler o PDF: ${(e as Error).message.slice(0, 200)}`,
    };
  }
}

/** Texto puro (.txt) entra direto; formatos binários que não sejam PDF ficam sem extração. */
export async function extrairTexto(
  dados: Uint8Array,
  formato: "pdf" | "docx" | "imagem" | "texto",
): Promise<ResultadoExtracao> {
  if (formato === "pdf") return extrairTextoPdf(dados);
  if (formato === "texto") {
    const texto = Buffer.from(dados).toString("utf8").trim();
    return texto
      ? { texto: truncar(texto), paginas: null, status: "ok" }
      : { texto: null, paginas: null, status: "sem_texto" };
  }
  return {
    texto: null,
    paginas: null,
    status: "nao_aplica",
    motivo:
      formato === "imagem"
        ? "Imagem não tem texto extraível sem OCR."
        : "Extração de .doc/.docx ainda não implementada; o arquivo fica anexado ao processo.",
  };
}
