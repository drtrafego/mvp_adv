/** Utilidades de apresentação de prazos (cor por estado, dias restantes). */

export type StatusPrazo = "sugerido" | "confirmado" | "editado" | "cancelado";

/** Data civil do escritório. Mantém servidor e navegador no mesmo fuso. */
export function hojeEscritorio(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export interface EstiloStatus {
  label: string;
  /** classes Tailwind para o badge */
  badge: string;
  marcador: string; // emoji/ponto
}

export const FILTROS_PRAZO = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "revisao", rotulo: "A revisar" },
  { valor: "prioridade", rotulo: "Até 7 dias" },
  { valor: "futuros", rotulo: "Mais de 7 dias" },
  { valor: "vencidos", rotulo: "Vencidos" },
] as const;
export type FiltroPrazo = (typeof FILTROS_PRAZO)[number]["valor"];

export function filtroPrazoValido(valor: string | undefined): FiltroPrazo {
  return FILTROS_PRAZO.find((f) => f.valor === valor)?.valor ?? "todos";
}

export function pendenciasDoPrazo(divergencia: unknown): string[] {
  if (!divergencia || typeof divergencia !== "object" || !("conferir" in divergencia)) return [];
  const itens = (divergencia as { conferir?: unknown }).conferir;
  return Array.isArray(itens) ? itens.map(String) : [];
}

export function estiloStatus(status: string, origem: string): EstiloStatus {
  if (status === "sugerido" || (!status && origem === "maquina"))
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
  const hoje = new Date(`${hojeEscritorio()}T00:00:00Z`);
  const alvo = new Date(`${dataFatal.slice(0, 10)}T00:00:00Z`);
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
