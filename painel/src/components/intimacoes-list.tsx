import Link from "next/link";
import { Inbox, BellRing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IntimacaoRow } from "@/db/queries";

function dataBr(d: string | null): string {
  if (!d) return "-";
  const [a, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

export function IntimacoesList({ intimacoes }: { intimacoes: IntimacaoRow[] }) {
  if (intimacoes.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Inbox className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-base font-medium">Nenhuma intimação coletada</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          No terminal:{" "}
          <span className="font-mono text-foreground">&quot;puxa minhas intimações de hoje&quot;</span>.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {intimacoes.map((i) => {
        const teor = (i.inteiroTeor ?? "").replace(/\s+/g, " ").trim();
        return (
          // O card inteiro abre o inteiro teor, no mesmo padrão de modal do resto do sistema.
          // O link do processo, dentro dele, continua levando ao processo (por isso não é <a>
          // aninhado: o Link do CNJ fica fora do fluxo de clique do card, com stopPropagation
          // implícito por ser um elemento interativo próprio em cima da área clicável).
          <Link
            key={i.id}
            href={`/i/${i.id}`}
            className="group block rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.02] transition-colors hover:border-indigo-brand/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-indigo-tint text-indigo-brand">
                  <BellRing className="h-3.5 w-3.5" />
                </span>
                <span className="truncate font-serif text-[0.95rem] font-medium">
                  {i.tipo ?? "Comunicação"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!i.processada && (
                  <Badge className="bg-amber-tint text-amber-brand text-[0.6rem] uppercase">nova</Badge>
                )}
                <Badge
                  className={
                    i.temPrazo
                      ? "bg-moss-tint text-moss-brand text-[0.6rem] uppercase"
                      : "bg-amber-tint text-amber-brand text-[0.6rem] uppercase"
                  }
                >
                  {i.temPrazo ? "com prazo" : "sem prazo"}
                </Badge>
                <Badge variant="outline" className="text-[0.6rem] uppercase">
                  {i.meio ?? "DJEN"}
                </Badge>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
              <span>disponibilizada {dataBr(i.dataDisponibilizacao)}</span>
              {i.oabDestino && <span>OAB {i.oabDestino}</span>}
              {i.numeroCnj ? (
                <span className="text-indigo-brand">{i.numeroCnj}</span>
              ) : i.numeroProcesso ? (
                <span>{i.numeroProcesso}</span>
              ) : null}
            </div>

            {teor && (
              <>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{teor}</p>
                <span className="mt-1.5 inline-block font-mono text-[0.65rem] uppercase tracking-wide text-indigo-brand opacity-0 transition-opacity group-hover:opacity-100">
                  abrir inteiro teor
                </span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
