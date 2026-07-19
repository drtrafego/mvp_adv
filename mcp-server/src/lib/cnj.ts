/**
 * Utilitários do número único CNJ (Resolução CNJ 65/2008).
 * Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
 *   NNNNNNN sequencial, DD dígito verificador, AAAA ano,
 *   J segmento do judiciário, TR tribunal, OOOO unidade de origem.
 */

/** Remove máscara, deixando só os 20 dígitos. */
export function limparCNJ(numero: string): string {
  return numero.replace(/\D/g, "");
}

/** Aplica a máscara NNNNNNN-DD.AAAA.J.TR.OOOO. */
export function formatarCNJ(numero: string): string {
  const n = limparCNJ(numero).padStart(20, "0");
  return `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16, 20)}`;
}

/** Valida o dígito verificador (módulo 97, ISO 7064) do número CNJ. */
export function validarCNJ(numero: string): boolean {
  const n = limparCNJ(numero);
  if (n.length !== 20) return false;
  const seq = n.slice(0, 7);
  const dv = n.slice(7, 9);
  const ano = n.slice(9, 13);
  const j = n.slice(13, 14);
  const tr = n.slice(14, 16);
  const orig = n.slice(16, 20);
  // Cálculo conforme art. 2º da Resolução 65: dígito = 98 - ((seq+ano+jtr+orig) concatenado sem DV) mod 97
  const base = `${seq}${ano}${j}${tr}${orig}`;
  const resto = mod97(base + "00");
  const dvCalc = String(98 - resto).padStart(2, "0");
  return dvCalc === dv;
}

function mod97(numStr: string): number {
  // processa em blocos para evitar estouro de precisão
  let resto = 0;
  for (let i = 0; i < numStr.length; i += 7) {
    const bloco = String(resto) + numStr.slice(i, i + 7);
    resto = Number(bloco) % 97;
  }
  return resto;
}

/**
 * Mapa segmento(J) + tribunal(TR) -> alias do endpoint DataJud (api_publica_<alias>).
 * Cobertura dos tribunais mais comuns; expandir conforme a carteira do escritório.
 * J: 4=Justiça Federal, 5=Justiça do Trabalho, 6=Eleitoral, 8=Justiça Estadual,
 *    1/2/3=STF/CNJ/STJ e Superiores, 7=Justiça Militar da União, 9=Militar Estadual.
 */
// Códigos oficiais TR da Justiça Estadual (Resolução CNJ 65/2008, Anexo). Ordem por código.
const MAPA_ESTADUAL: Record<string, string> = {
  "01": "tjac", "02": "tjal", "03": "tjap", "04": "tjam", "05": "tjba",
  "06": "tjce", "07": "tjdft", "08": "tjes", "09": "tjgo", "10": "tjma",
  "11": "tjmt", "12": "tjms", "13": "tjmg", "14": "tjpa", "15": "tjpb",
  "16": "tjpr", "17": "tjpe", "18": "tjpi", "19": "tjrj", "20": "tjrn",
  "21": "tjrs", "22": "tjro", "23": "tjrr", "24": "tjsc", "25": "tjse",
  "26": "tjsp", "27": "tjto",
};

const MAPA_FEDERAL: Record<string, string> = {
  "01": "trf1", "02": "trf2", "03": "trf3", "04": "trf4", "05": "trf5", "06": "trf6",
};

/**
 * Deriva o alias do DataJud a partir do número CNJ.
 * Retorna null quando não conseguir mapear (tribunal fora do mapa).
 */
export function aliasDataJud(numero: string): string | null {
  const n = limparCNJ(numero);
  if (n.length !== 20) return null;
  const j = n.slice(13, 14);
  const tr = n.slice(14, 16);
  switch (j) {
    case "8":
      return MAPA_ESTADUAL[tr] ?? null;
    case "4":
      return MAPA_FEDERAL[tr] ?? null;
    case "5":
      return `trt${Number(tr)}`; // Justiça do Trabalho: TRT da região = número do TR
    case "6":
      return `tre${MAPA_ESTADUAL[tr]?.slice(2) ?? tr}`;
    case "3":
      return "stj";
    case "1":
      return tr === "00" ? "stf" : null;
    default:
      return null;
  }
}
