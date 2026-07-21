"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Users, Briefcase, UserPlus } from "lucide-react";
import { criarClienteAction } from "@/app/actions";
import type { ClienteRow } from "@/db/queries";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase();
}

const cardClass =
  "flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm shadow-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function Conteudo({ c }: { c: ClienteRow }) {
  return (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-tint font-serif text-sm font-semibold text-indigo-brand">
        {iniciais(c.nome)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-[0.95rem] font-medium">{c.nome}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Briefcase className="h-3 w-3" />
          {c.totalProcessos} {c.totalProcessos === 1 ? "processo" : "processos"}
        </div>
      </div>
    </>
  );
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
      {clientes.map((c) =>
        c.clienteId ? (
          <Link key={c.nome} href={`/c/${c.clienteId}`} className={cardClass}>
            <Conteudo c={c} />
          </Link>
        ) : (
          <CardSemCadastro key={c.nome} c={c} />
        ),
      )}
    </div>
  );
}

function CardSemCadastro({ c }: { c: ClienteRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function cadastrar() {
    start(async () => {
      const r = await criarClienteAction(c.nome);
      if (r.ok && r.id) {
        toast.success("Cliente cadastrado.");
        router.push(`/c/${r.id}`);
      } else {
        toast.error(r.erro ?? "Falha ao cadastrar.");
      }
    });
  }

  return (
    <button type="button" onClick={cadastrar} disabled={pending} className={cardClass}>
      <Conteudo c={c} />
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5" /> cadastrar
      </span>
    </button>
  );
}
