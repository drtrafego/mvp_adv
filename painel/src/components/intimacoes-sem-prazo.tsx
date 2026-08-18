import Link from "next/link";
import { BellRing, ArrowRight, Check } from "lucide-react";
import { marcarCuidada } from "@/app/(app)/intimacoes/actions";
import type { IntimacaoRow } from "@/db/queries";

function dataBr(d: string | null): string {
  if (!d) return "-";
  const [a, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

/**
 * Fila de intimações coletadas que ainda não viraram prazo. Aparece na Início e na aba
 * Prazos para que uma coleta feita no terminal aviste todo o sistema, e não só a aba
 * Intimações. O prazo em si continua nascendo só pelo fluxo prazos-cpc, no terminal.
 */
export function IntimacoesSemPrazo({
  intimacoes,
  total,
  compacto = false,
}: {
  intimacoes: IntimacaoRow[];
  /** Quantas existem no total (a lista vem limitada). */
  total: number;
  compacto?: boolean;
}) {
  if (total === 0) return null;
  const mostradas = compacto ? intimacoes.slice(0, 3) : intimacoes;
  const restantes = total - mostradas.length;

  return (
    <div className="rounded-xl border border-amber-brand/30 bg-amber-tint/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-base font-semibold text-amber-brand">
          <BellRing className="h-4 w-4" />
          {total === 1
            ? "1 intimação ainda sem prazo calculado"
            : `${total} intimações ainda sem prazo calculado`}
        </h2>
        <Link
          href="/intimacoes"
          className="inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wide text-amber-brand hover:underline"
        >
          ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        A coleta traz a intimação; a data fatal nasce do cálculo, nunca de estimativa. No terminal,
        peça{" "}
        <span className="font-mono text-foreground">&quot;calcula os prazos das intimações novas&quot;</span>{" "}
        e elas aparecem aqui como prazo sugerido, para você confirmar.
      </p>

      <ul className="mt-4 space-y-2">
        {mostradas.map((i) => (
          <li
            key={i.id}
            className="flex items-stretch gap-2 rounded-lg border border-amber-brand/20 bg-card/70 transition-colors hover:border-amber-brand/50"
          >
            <Link href={`/i/${i.id}`} className="min-w-0 flex-1 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-serif text-sm font-medium">
                  {i.tipo ?? "Comunicação"}
                </span>
                <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
                  {dataBr(i.dataDisponibilizacao)}
                </span>
              </div>
              {(i.numeroCnj ?? i.numeroProcesso) && (
                <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-indigo-brand">
                  {i.numeroCnj ?? i.numeroProcesso}
                </span>
              )}
            </Link>

            {/* Sem prazo a praticar: sai da fila sem virar prazo nenhum. */}
            <form action={marcarCuidada} className="flex shrink-0 items-center pr-2">
              <input type="hidden" name="id" value={i.id} />
              <button
                type="submit"
                title="Não gera prazo, já cuidei"
                className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground transition-colors hover:border-moss-brand/40 hover:text-moss-brand"
              >
                <Check className="h-3 w-3" />
                cuidei
              </button>
            </form>
          </li>
        ))}
      </ul>

      {restantes > 0 && (
        <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          e mais {restantes} na aba Intimações
        </p>
      )}
    </div>
  );
}
