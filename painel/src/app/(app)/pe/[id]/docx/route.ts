import { detalhePeca } from "@/db/queries";
import { getUsuarioAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Escapa texto para RTF: chaves, barra invertida e não-ASCII (acentos viram \uNNNN). */
function rtfEscape(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch;
    else if (ch === "\r") continue;
    else if (code > 127) out += `\\u${code}?`;
    else out += ch;
  }
  return out;
}

/**
 * Formatação forense brasileira, em twips (1/20 de ponto):
 * A4 retrato, margem esquerda 3 cm e as demais 2 cm, entrelinha 1,5, recuo de primeira linha
 * de 1,25 cm. Fonte 12 (24 half-points).
 */
const A4_LARGURA = 11906;
const A4_ALTURA = 16838;
const MARGEM_ESQ = 1701; // 3 cm
const MARGEM_DEMAIS = 1134; // 2 cm
const ENTRELINHA = 360; // 1,5 linha
const RECUO_1A_LINHA = 709; // 1,25 cm

/** Uma linha é título de seção quando vem toda em maiúsculas (DOS FATOS, DO DIREITO...). */
function ehTitulo(linha: string): boolean {
  const t = linha.trim();
  if (t.length < 3 || t.length > 120) return false;
  if (!/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(t)) return false;
  return t === t.toUpperCase();
}

/**
 * Converte o corpo da peça em parágrafos RTF: título em negrito e centralizado, texto comum
 * justificado com recuo de primeira linha.
 */
function corpoParaRtf(texto: string): string {
  return texto
    .split("\n")
    .map((linha) => {
      const conteudo = rtfEscape(linha.trim());
      if (!conteudo) return `\\pard\\sl${ENTRELINHA}\\slmult1\\par`;
      if (ehTitulo(linha)) {
        return `\\pard\\qc\\sl${ENTRELINHA}\\slmult1\\sb240\\sa120\\b ${conteudo}\\b0\\par`;
      }
      return `\\pard\\qj\\fi${RECUO_1A_LINHA}\\sl${ENTRELINHA}\\slmult1\\sa120 ${conteudo}\\par`;
    })
    .join("\n");
}

/**
 * Exporta a peça em RTF (Rich Text Format), já no padrão forense: A4, margens brasileiras,
 * entrelinha 1,5, corpo justificado, títulos centralizados em negrito e número de página no
 * rodapé. Word, LibreOffice e Google Docs abrem nativamente; o advogado revisa, assina e salva
 * como .docx. Sem dependência externa.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autorizado.", { status: 401 });

  const { id } = await params;
  const detalhe = await detalhePeca(id);
  if (!detalhe) return new Response("Peça não encontrada.", { status: 404 });

  const { peca } = detalhe;
  const titulo = peca.titulo ?? `Rascunho de ${peca.tipo}`;
  const corpo = peca.conteudo ?? "";
  const aviso =
    "RASCUNHO gerado pela máquina. Revise, ajuste e assine antes de protocolar. " +
    "A responsabilidade é do advogado.";

  // \\chpgn = número da página corrente; o rodapé sai centralizado em corpo 10.
  const rodape = `{\\footer\\pard\\qc\\fs20 \\chpgn\\par}`;

  const rtf =
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Arial;}}\\fs24\n` +
    `\\paperw${A4_LARGURA}\\paperh${A4_ALTURA}` +
    `\\margl${MARGEM_ESQ}\\margr${MARGEM_DEMAIS}\\margt${MARGEM_DEMAIS}\\margb${MARGEM_DEMAIS}\n` +
    rodape +
    `\n\\pard\\qc\\sl${ENTRELINHA}\\slmult1\\sa240\\b ${rtfEscape(titulo)}\\b0\\par\n` +
    corpoParaRtf(corpo) +
    `\n\\pard\\qc\\sl${ENTRELINHA}\\slmult1\\sb360\\i\\fs18 ${rtfEscape(aviso)}\\i0\\par\n}`;

  const nome = `${peca.tipo}-${id.slice(0, 8)}.rtf`;
  return new Response(rtf, {
    headers: {
      "Content-Type": "application/rtf; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
