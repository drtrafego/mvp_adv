/**
 * Convenções da camada de documentos: categorias, caminho no storage e limites.
 *
 * ATENÇÃO: este arquivo é ESPELHADO em `painel/src/lib/documentos.ts`. Os dois precisam gerar
 * exatamente o mesmo `storagePath`, senão o mesmo arquivo subido pelo painel e pelo terminal cai
 * em lugares diferentes do Blob. Alterou aqui, altere lá.
 */

/** Função processual do documento. Ordem = ordem processual, não alfabética. */
export const CATEGORIAS = [
  { valor: "inicial", rotulo: "Petição inicial" },
  { valor: "procuracao", rotulo: "Procuração" },
  { valor: "contestacao", rotulo: "Contestação" },
  { valor: "replica", rotulo: "Réplica" },
  { valor: "despacho", rotulo: "Despacho" },
  { valor: "decisao", rotulo: "Decisão" },
  { valor: "sentenca", rotulo: "Sentença" },
  { valor: "acordao", rotulo: "Acórdão" },
  { valor: "recurso", rotulo: "Recurso" },
  { valor: "contrarrazoes", rotulo: "Contrarrazões" },
  { valor: "ata_audiencia", rotulo: "Ata de audiência" },
  { valor: "prova", rotulo: "Prova / documento" },
  { valor: "laudo", rotulo: "Laudo" },
  { valor: "contrato", rotulo: "Contrato" },
  { valor: "comprovante", rotulo: "Comprovante" },
  { valor: "certidao", rotulo: "Certidão" },
  { valor: "outro", rotulo: "Outro" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["valor"];

export const VALORES_CATEGORIA = CATEGORIAS.map((c) => c.valor) as [string, ...string[]];

export function ehCategoria(v: string): v is Categoria {
  return CATEGORIAS.some((c) => c.valor === v);
}

export function rotuloCategoria(v: string): string {
  return CATEGORIAS.find((c) => c.valor === v)?.rotulo ?? v;
}

/** Extensões aceitas e o MIME correspondente. */
export const MIMES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".rtf": "application/rtf",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  // iPhone salva foto em HEIC por padrão; o advogado fotografa documento o tempo todo.
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/** Formato normalizado gravado em `documentos.tipo`. */
export function formatoDeExtensao(ext: string): "pdf" | "docx" | "imagem" | "texto" {
  const e = ext.toLowerCase();
  if (e === ".pdf") return "pdf";
  if (e === ".docx" || e === ".doc") return "docx";
  if ([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(e)) return "imagem";
  return "texto";
}

/**
 * Teto de tamanho. Autos completos e fotos de documento passam fácil de dezenas de MB, e o
 * arquivo não trafega pelo servidor (vai do navegador direto para o storage), então o limite
 * aqui é de sanidade e de custo, não uma restrição técnica.
 */
export const TAMANHO_MAX_PAINEL = 200 * 1024 * 1024;
export const TAMANHO_MAX_TERMINAL = 500 * 1024 * 1024;

/** Texto extraído por documento. Ele viaja para o contexto do modelo, então tem teto. */
export const TEXTO_MAX = 2 * 1024 * 1024;
export const MARCA_TRUNCADO = "\n\n[...texto truncado]";

export function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      // remove os diacríticos separados pelo NFD (o "~" de ção, o acento de é)
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "documento"
  );
}

/**
 * Caminho do arquivo no Blob. Imutável depois de gravado.
 *
 *   processos/<cnj só dígitos>/<categoria>/<AAAA-MM-DD>-<slug>-<hash8>.<ext>
 *
 * O prefixo por processo permite listar e apagar por processo; a categoria como pasta é a
 * divisão das peças por tipo, legível para quem abrir o storage direto.
 */
export function montarStoragePath(params: {
  numeroCnj: string;
  categoria: string;
  titulo: string;
  hashSha256: string;
  extensao: string;
  data?: string;
}): string {
  const cnj = params.numeroCnj.replace(/\D/g, "");
  const data = params.data ?? new Date().toISOString().slice(0, 10);
  const hash8 = params.hashSha256.slice(0, 8);
  const ext = params.extensao.toLowerCase().replace(/^\.?/, ".");
  return `processos/${cnj}/${params.categoria}/${data}-${slug(params.titulo)}-${hash8}${ext}`;
}
