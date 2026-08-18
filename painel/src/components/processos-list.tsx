import Link from "next/link";
import { FolderOpen, Building2, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProcessoRow } from "@/db/queries";

function desde(d: Date | null): string {
  if (!d) return "nunca sincronizado";
  const dias = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  if (dias <= 0) return "sincronizado hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

export function ProcessosList({ processos }: { processos: ProcessoRow[] }) {
  if (processos.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FolderOpen className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-base font-medium">Carteira vazia</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          No terminal:{" "}
          <span className="font-mono text-foreground">&quot;adiciona o processo tal do cliente Fulano&quot;</span>.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {processos.map((p) => (
        <Link
          key={p.id}
          href={`/p/${p.id}`}
          className="group rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.05] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-sm">{p.numeroCnj}</span>
            <Badge variant="outline" className="shrink-0 text-[0.65rem] uppercase">
              {p.status ?? "ativo"}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-serif text-base font-medium">
            {p.clienteNome ?? "sem cliente"}
            {/* Amarelo: cliente deduzido do polo único das intimações, ainda sem confirmação. */}
            {p.clienteOrigem === "maquina" && (
              <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.55rem] uppercase text-amber-brand">
                <Bot className="mr-1 h-3 w-3" /> sugerido
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {p.classe ?? "-"} · {p.tribunal}
          </div>
          <div className="mt-2 font-mono text-[0.7rem] text-muted-foreground">{desde(p.ultimaSincronizacao)}</div>
        </Link>
      ))}
    </div>
  );
}
