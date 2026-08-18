/** Utilidades de apresentação de análises (severidade do risco e resultado para o cliente). */

export interface EstiloAnalise {
  txt: string;
  /** classes Tailwind do selo */
  cls: string;
  /** classe de borda, para a faixa de alerta */
  borda: string;
}

/** Severidade do risco, conforme a skill saida-forense. */
export const SEVERIDADE: Record<string, EstiloAnalise> = {
  critico: {
    txt: "crítico",
    cls: "bg-destructive/10 text-destructive",
    borda: "border-destructive",
  },
  alto: { txt: "alto", cls: "bg-amber-tint text-amber-brand", borda: "border-amber-brand" },
  medio: { txt: "médio", cls: "bg-amber-tint/60 text-amber-brand", borda: "border-amber-brand/60" },
  baixo: { txt: "baixo", cls: "bg-muted text-muted-foreground", borda: "border-border" },
};

/** Estilo da severidade, com fallback para quando a análise não a informou. */
export function estiloSeveridade(severidade?: string | null): EstiloAnalise | null {
  if (!severidade) return null;
  return SEVERIDADE[severidade] ?? { txt: severidade, cls: "bg-muted text-muted-foreground", borda: "border-border" };
}

/** Selo de como o ato impacta o cliente: favorável, desfavorável ou neutro. */
export function seloResultado(resultado?: string | null): { txt: string; cls: string } {
  const r = (resultado ?? "").toLowerCase();
  if (r.includes("favor") && !r.includes("des"))
    return { txt: "favorável", cls: "bg-moss-tint text-moss-brand" };
  if (r.includes("desfavor")) return { txt: "desfavorável", cls: "bg-amber-tint text-amber-brand" };
  return { txt: "neutro", cls: "bg-muted text-muted-foreground" };
}
