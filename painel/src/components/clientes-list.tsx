import { Users, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClienteRow } from "@/db/queries";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export function ClientesList({ clientes }: { clientes: ClienteRow[] }) {
  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Users className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-base font-medium">Nenhum cliente ainda</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Os clientes aparecem aqui conforme os processos são cadastrados na carteira.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {clientes.map((c) => (
        <div
          key={c.nome}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-tint font-serif text-sm font-semibold text-indigo-brand">
            {iniciais(c.nome)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-serif text-[0.95rem] font-medium">{c.nome}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              {c.totalProcessos} {c.totalProcessos === 1 ? "processo" : "processos"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
