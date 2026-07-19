/** Utilidades de apresentação de prazos (cor por estado, dias restantes). */

export type StatusPrazo = "sugerido" | "confirmado" | "editado" | "cancelado";

export interface EstiloStatus {
  label: string;
  /** classes Tailwind para o badge */
  badge: string;
  marcador: string; // emoji/ponto
}

export function estiloStatus(status: string, origem: string): EstiloStatus {
  if (status === "sugerido")
    return {
      label: "sugerido",
      badge: "bg-amber-tint text-amber-brand border border-amber-brand/30",
      marcador: "🟡",
    };
  if (status === "confirmado")
    return {
      label: "confirmado",
      badge: "bg-moss-tint text-moss-brand border border-moss-brand/30",
      marcador: "🟢",
    };
  if (status === "editado")
    return {
      label: "editado",
      badge: "bg-moss-tint text-moss-brand border border-dashed border-moss-brand/50",
      marcador: "🟢",
    };
  return {
    label: status,
    badge: "bg-muted text-muted-foreground border",
    marcador: "⚪",
  };
}

/** Dias corridos entre hoje e a data fatal (negativo = vencido). */
export function diasRestantes(dataFatal: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = dataFatal.split("-").map(Number);
  const alvo = new Date(y, m - 1, d);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

/** Rótulo de urgência a partir dos dias restantes. */
export function urgencia(dias: number): { texto: string; classe: string } {
  if (dias < 0) return { texto: `vencido há ${-dias}d`, classe: "text-destructive font-semibold" };
  if (dias === 0) return { texto: "vence HOJE", classe: "text-destructive font-semibold" };
  if (dias === 1) return { texto: "vence amanhã", classe: "text-destructive font-semibold" };
  if (dias <= 3) return { texto: `faltam ${dias}d`, classe: "text-amber-brand font-semibold" };
  if (dias <= 7) return { texto: `faltam ${dias}d`, classe: "text-amber-brand" };
  return { texto: `faltam ${dias}d`, classe: "text-muted-foreground" };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Formata 'YYYY-MM-DD' como '25 mar 2026'. */
export function formatarData(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES[m - 1]} ${y}`;
}
