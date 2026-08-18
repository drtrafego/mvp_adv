import Link from "next/link";
import { BellRing, Clock } from "lucide-react";
import { estiloSeveridade } from "@/lib/analise-ui";
import { formatarData } from "@/lib/prazo-ui";
import type { IntimacaoRecente } from "@/db/queries";

/**
 * O que chegou nos últimos dias e o que o sistema achou de cada coisa. Responde de manhã a
 * pergunta que ficava sem resposta: saiu intimação hoje, e daí? Aqui aparece a leitura da
 * máquina (sugestão), o prazo quando já foi calculado e o estado de cada intimação.
 */
export function ChegouAgora({ intimacoes }: { intimacoes: IntimacaoRecente[] }) {
  if (intimacoes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {intimacoes.map((i) => {
        const severidade = i.temAnalise ? estiloSeveridade(i.severidade) : null;
        const estado = i.processada
          ? { txt: "cuidada", cls: "bg-moss-tint text-moss-brand" }
          : i.temAnalise
            ? { txt: "analisada", cls: "bg-indigo-tint text-indigo-brand" }
            : { txt: "sem análise", cls: "bg-amber-tint text-amber-brand" };

        return (
          <Link
            key={i.id}
            href={`/i/${i.id}`}
            className="rounded-xl border bg-card p-3.5 shadow-sm shadow-black/[0.02] transition-colors hover:border-indigo-brand/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-indigo-tint text-indigo-brand">
                  <BellRing className="h-3 w-3" />
                </span>
                <span className="truncate font-serif text-[0.95rem] font-medium">
                  {i.tipo ?? "Comunicação"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {severidade && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${severidade.cls}`}
                  >
                    risco {severidade.txt}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${estado.cls}`}
                >
                  {estado.txt}
                </span>
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
              <span>{formatarData(i.dataDisponibilizacao)}</span>
              {(i.numeroCnj ?? i.numeroProcesso) && (
                <span className="text-indigo-brand">{i.numeroCnj ?? i.numeroProcesso}</span>
              )}
              {i.clienteNome && <span className="truncate">{i.clienteNome}</span>}
            </div>

            {i.acaoNecessaria && (
              <p className="mt-1.5 line-clamp-1 text-sm text-foreground/90">{i.acaoNecessaria}</p>
            )}

            {i.dataFatal && (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-tint/60 px-2 py-0.5 font-mono text-[0.7rem] text-amber-brand">
                <Clock className="h-3 w-3" /> fatal {formatarData(i.dataFatal)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
