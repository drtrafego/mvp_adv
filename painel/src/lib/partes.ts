/**
 * Normalização de nome de parte, no painel.
 *
 * Espelha `mcp-server/src/lib/partes.ts` (mesma regra, mesma saída): os dois lados precisam
 * chegar à MESMA chave, senão o advogado confirma no painel um nome que o motor considera outro
 * e o cliente vira dois cadastros. É duplicação consciente: o painel é o Root Directory do deploy
 * na Vercel e não pode importar arquivo de fora dele.
 */

const EQUIVALENCIAS: Array<[RegExp, string]> = [
  [/\bSOCIEDADE ANONIMA\b/g, "SA"],
  [/\bSOCIEDADE LIMITADA\b/g, "LTDA"],
  [/\bLIMITADA\b/g, "LTDA"],
  [/\bLTDA\b/g, "LTDA"],
  [/\bS A\b/g, "SA"],
  [/\bCOMPANHIA\b/g, "CIA"],
  [/\bMICROEMPRESA\b/g, "ME"],
  [/\bMICRO EMPRESA\b/g, "ME"],
  [/\bMEI\b/g, "MEI"],
  [/\bEPP\b/g, "EPP"],
  [/\bEIRELI\b/g, "EIRELI"],
];

/** Chave de comparação de nome. O nome original NUNCA é alterado. */
export function normalizarNome(nome: string): string {
  let s = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  s = s.replace(/&/g, " E ");
  s = s.replace(/[^A-Z0-9]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (const [de, para] of EQUIVALENCIAS) s = s.replace(de, para);
  return s.replace(/\s+/g, " ").trim();
}

/** Papel neutro derivado do polo: nomear "autor" ou "exequente" já seria afirmar o rito. */
export function papelDoPolo(polo: string | null | undefined): string {
  const p = (polo ?? "").trim().toUpperCase();
  if (p === "A") return "polo ativo";
  if (p === "P") return "polo passivo";
  return "parte";
}

/** O polo contrário, para descartar de uma vez a detecção do outro lado do processo. */
export function poloOposto(polo: string | null | undefined): "A" | "P" | null {
  const p = (polo ?? "").trim().toUpperCase();
  if (p === "A") return "P";
  if (p === "P") return "A";
  return null;
}

export function rotuloPolo(polo: string | null | undefined): string {
  const p = (polo ?? "").trim().toUpperCase();
  if (p === "A") return "polo ativo";
  if (p === "P") return "polo passivo";
  return "polo não informado";
}
