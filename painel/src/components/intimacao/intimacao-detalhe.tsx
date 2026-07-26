"use client";

import Link from "next/link";
import { BellRing, CalendarDays, ExternalLink, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/prazo-ui";
import type { DetalheIntimacao } from "@/db/queries";

/**
 * Inteiro teor da intimação. A lista mostra só as duas primeiras linhas; aqui vem o texto
 * completo, que é a fonte oficial do prazo e o que o advogado precisa ler antes de decidir.
 */
export function IntimacaoDetalhe({ detalhe }: { detalhe: DetalheIntimacao }) {
  const { intimacao, processo, prazos } = detalhe;
  const teor = (intimacao.inteiroTeor ?? "").trim();

  function copiar() {
    navigator.clipboard.writeText(teor).then(
      () => toast.success("Inteiro teor copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b bg-muted/30 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-indigo-brand/30 bg-indigo-tint text-indigo-brand">
            <BellRing className="mr-1 h-3 w-3" /> {intimacao.meio ?? "DJEN"}
          </Badge>
          {!intimacao.processada && (
            <Badge className="bg-amber-tint text-[0.6rem] uppercase text-amber-brand">nova</Badge>
          )}
        </div>

        <h2 className="mt-2 font-serif text-xl font-semibold leading-tight">
          {intimacao.tipo ?? "Comunicação"}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            disponibilizada em {formatarData(intimacao.dataDisponibilizacao)}
          </span>
          {intimacao.oabDestino && <span>OAB {intimacao.oabDestino}</span>}
        </div>

        {(processo || intimacao.numeroProcesso) && (
          <p className="mt-1 font-mono text-sm">
            {processo ? (
              <Link href={`/p/${processo.id}`} className="text-indigo-brand hover:underline">
                {processo.numeroCnj}
                {processo.clienteNome ? ` · ${processo.clienteNome}` : ""}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                {intimacao.numeroProcesso} (processo ainda não está na carteira)
              </span>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copiar}>
            <Copy /> Copiar teor
          </Button>
          {processo && (
            <Button size="sm" variant="ghost" render={<Link href={`/p/${processo.id}`} />}>
              <ExternalLink /> Ver processo
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {prazos.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              Prazos que nasceram desta intimação
            </h3>
            <ul className="space-y-1.5">
              {prazos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pz/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-brand" />
                      <span className="truncate">{p.ato}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs">{formatarData(p.dataFatal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h3 className="mb-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          Inteiro teor
        </h3>
        {teor ? (
          // whitespace-pre-wrap preserva a formatação do diário; break-words evita estourar a
          // largura em números de processo e IDs longos, que são comuns no texto.
          <div className="whitespace-pre-wrap break-words rounded-xl border bg-card p-4 text-sm leading-relaxed text-foreground/90">
            {teor}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed bg-card/40 p-4 text-sm text-muted-foreground">
            Esta comunicação foi coletada sem o inteiro teor.
          </p>
        )}
      </div>
    </div>
  );
}
