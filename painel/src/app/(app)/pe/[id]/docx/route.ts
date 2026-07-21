import { detalhePeca } from "@/db/queries";

export const dynamic = "force-dynamic";

/** Escapa texto para RTF: chaves, barra invertida, quebras de linha e não-ASCII. */
function rtfEscape(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch;
    else if (ch === "\n") out += "\\par\n";
    else if (ch === "\r") continue;
    else if (code > 127) out += `\\u${code}?`;
    else out += ch;
  }
  return out;
}

/**
 * Exporta a peça em RTF (Rich Text Format). Word, LibreOffice e Google Docs abrem
 * nativamente; o advogado revisa, assina e salva como .docx. Sem dependências externas.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = await detalhePeca(id);
  if (!detalhe) return new Response("Peça não encontrada.", { status: 404 });

  const { peca } = detalhe;
  const titulo = peca.titulo ?? `Rascunho de ${peca.tipo}`;
  const corpo = peca.conteudo ?? "";
  const aviso =
    "RASCUNHO gerado pela máquina. Revise, ajuste e assine antes de protocolar. " +
    "A responsabilidade é do advogado.";

  const rtf =
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\fs24\n` +
    `{\\b ${rtfEscape(titulo)}}\\par\\par\n` +
    `${rtfEscape(corpo)}\\par\\par\n` +
    `{\\i\\fs18 ${rtfEscape(aviso)}}\n}`;

  const nome = `${peca.tipo}-${id.slice(0, 8)}.rtf`;
  return new Response(rtf, {
    headers: {
      "Content-Type": "application/rtf; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
