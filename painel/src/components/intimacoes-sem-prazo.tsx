import Link from "next/link";
import { BellRing, ArrowRight } from "lucide-react";

/**
 * Faixa de aviso: quantas intimações coletadas ainda não viraram prazo. Aparece na Início e na
 * aba Prazos só para dar o sinal; a fila em si vive na aba Intimações, para não misturar duas
 * listas diferentes na mesma tela.
 */
export function IntimacoesSemPrazo({ total }: { total: number }) {
  if (total === 0) return null;

  return (
    <Link
      href="/intimacoes?filtro=sem-prazo"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-brand/30 bg-amber-tint/40 px-3 py-2 transition-colors hover:border-amber-brand/60"
    >
      <BellRing className="h-4 w-4 shrink-0 text-amber-brand" />
      <span className="text-sm font-medium text-amber-brand">
        {total === 1
          ? "1 intimação ainda sem prazo calculado"
          : `${total} intimações ainda sem prazo calculado`}
      </span>
      <span className="text-xs text-muted-foreground">
        a data fatal nasce do cálculo, nunca de estimativa
      </span>
      <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wide text-amber-brand">
        ver <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
