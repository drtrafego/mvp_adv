/**
 * Normalização e identidade de inscrição na OAB.
 *
 * Contexto empírico (DJEN): a mesma pessoa aparece com a OAB escrita em vários formatos
 * ("11158-B/MT", "11158/B/MT", "11158B/MT", "11158/MT", "11158B MT"). A letra A/B... é ruído
 * de digitação do cartório e NÃO diferencia advogado dentro da mesma seccional. A identidade
 * real é NÚMERO + UF. O nome serve de confirmação para cortar homônimo de número/UF diferente.
 */

export interface IdentidadeOab {
  numero: string;
  letra: string | null;
  uf: string;
}

// Tolerante: primeiro bloco de dígitos (número), letra opcional (A/B...) com separadores
// livres (barra, hífen, ponto, espaço) e a UF (duas letras) sempre no fim.
const REGEX_OAB = /(\d+)\s*[-/.\s]*\s*([A-Z])?\D*?([A-Z]{2})\s*$/;

/**
 * Extrai número, letra (opcional) e UF de uma OAB em qualquer um dos formatos do DJEN.
 * Retorna null se não achar número + UF.
 */
export function parseOab(raw: string): IdentidadeOab | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(REGEX_OAB);
  if (!m) return null;
  const numero = m[1].replace(/^0+/, "") || "0";
  const letra = m[2] ?? null;
  const uf = m[3];
  return { numero, letra, uf };
}

/**
 * Mesma pessoa na seccional: número e UF iguais. IGNORA a letra de propósito (é ruído de
 * digitação; "11158-A/MT" e "11158-B/MT" são o mesmo advogado).
 */
export function mesmaOab(a: IdentidadeOab, b: IdentidadeOab): boolean {
  return a.numero === b.numero && a.uf === b.uf;
}

/**
 * Forma canônica "numero/UF" (descarta a letra). Usada para gravar oab_destino sem ruído.
 * Retorna null quando não dá para parsear.
 */
export function canonicalOab(raw: string): string | null {
  const id = parseOab(raw);
  return id ? `${id.numero}/${id.uf}` : null;
}

/**
 * Verdadeiro se a OAB bruta bate (por número + UF) com algum dos alvos informados.
 * Usado para filtrar as intimações do DJEN e juntar os vários formatos do mesmo advogado.
 */
export function ehDoAdvogado(oabRaw: string, alvos: IdentidadeOab[]): boolean {
  const id = parseOab(oabRaw);
  if (!id) return false;
  return alvos.some((alvo) => mesmaOab(id, alvo));
}
