import Link from "next/link";
import { FileSignature, Bot, ShieldCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PecaRow } from "@/db/queries";

function quando(d: Date | null): string {
  if (!d) return "-";
  const dias = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "aguardando geração",
  gerado: "rascunho pronto",
  editado: "editado",
  arquivado: "arquivado",
};

export function PecasList({ pecas }: { pecas: PecaRow[] }) {
  if (pecas.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FileSignature className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-base font-medium">Nenhuma peça ainda</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Gere uma peça a partir de um prazo (aba Prazos) ou comece um caso novo pela aba Inicial.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {pecas.map((p) => (
        <Link
          key={p.id}
          href={`/pe/${p.id}`}
          className="group rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.05] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-serif text-base font-medium capitalize">
              {p.titulo ?? p.tipo}
            </span>
            {p.origem === "humana" ? (
              <Badge className="shrink-0 border border-moss-brand/30 bg-moss-tint text-[0.6rem] uppercase text-moss-brand">
                <ShieldCheck className="mr-1 h-3 w-3" /> aprovada
              </Badge>
            ) : (
              <Badge className="shrink-0 border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
                <Bot className="mr-1 h-3 w-3" /> máquina
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="capitalize">{p.tipo}</span>
            <span>·</span>
            <span>{STATUS_LABEL[p.status ?? ""] ?? p.status}</span>
          </div>
          <div className="mt-1 truncate font-mono text-[0.7rem] text-muted-foreground">
            {p.numeroCnj ?? "caso novo"}
            {p.clienteNome ? ` · ${p.clienteNome}` : ""}
          </div>
          <div className="mt-2 flex items-center gap-1 font-mono text-[0.7rem] text-muted-foreground">
            <Clock className="h-3 w-3" /> {quando(p.criadoEm)}
          </div>
        </Link>
      ))}
    </div>
  );
}
