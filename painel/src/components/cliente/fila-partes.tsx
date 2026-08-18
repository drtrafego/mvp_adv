"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Bot, Check, ShieldCheck, Users, X, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmarParteAction,
  descartarParteAction,
  confirmarPartesEmLoteAction,
} from "@/app/actions";
import { rotuloPolo } from "@/lib/partes";
import type { ParteAConfirmar } from "@/db/queries";

/**
 * A fila de trabalho: um cartão por processo, com as partes reconhecidas de um lado e o teor da
 * intimação do outro. É onde os processos sem cliente são resolvidos numa sessão.
 *
 * O botão de lote só aparece nos processos de confiança alta (polo único), onde a máquina já
 * gravou a sugestão e o advogado está apenas ratificando. Onde os dois polos foram intimados,
 * cada parte é decidida uma a uma, de propósito.
 */
export function FilaPartes({ partes }: { partes: ParteAConfirmar[] }) {
  const grupos = new Map<string, ParteAConfirmar[]>();
  for (const p of partes) {
    grupos.set(p.processoId, [...(grupos.get(p.processoId) ?? []), p]);
  }

  if (partes.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-moss-tint text-moss-brand">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-base font-medium">Fila vazia</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Nada esperando decisão. Quando chegarem intimações novas, as partes reconhecidas nelas
          aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {[...grupos.entries()].map(([processoId, lista]) => (
        <CartaoProcesso key={processoId} lista={lista} />
      ))}
    </div>
  );
}

function CartaoProcesso({ lista }: { lista: ParteAConfirmar[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const cabeca = lista[0];
  const todasAltas = lista.every((p) => p.confianca === "alta");
  const teor = lista.find((p) => p.teor)?.teor ?? null;

  function confirmarTodas() {
    start(async () => {
      const r = await confirmarPartesEmLoteAction(lista.map((p) => p.id));
      if (r.ok) toast.success(`${r.confirmadas} parte(s) confirmada(s).`);
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <Link href={`/p/${cabeca.processoId}`} className="font-mono text-sm hover:underline">
            {cabeca.numeroCnj}
          </Link>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[cabeca.classe, cabeca.tribunal].filter(Boolean).join(" · ")}
          </div>
        </div>
        {todasAltas ? (
          <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
            <Bot className="mr-1 h-3 w-3" /> polo único, já sugerido
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[0.6rem] uppercase">
            os dois polos intimados
          </Badge>
        )}
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_1fr]">
        <ul className="space-y-2">
          {lista.map((p) => (
            <ItemParte key={p.id} p={p} />
          ))}
          {todasAltas && lista.length > 1 && (
            <li>
              <Button size="sm" variant="outline" onClick={confirmarTodas} disabled={pending}>
                <Check /> Confirmar as {lista.length} como clientes
              </Button>
            </li>
          )}
        </ul>

        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> teor da intimação
          </div>
          {teor ? (
            <>
              <p className={`text-xs leading-relaxed text-muted-foreground ${aberto ? "" : "line-clamp-[12]"}`}>
                {teor}
              </p>
              <Button
                size="xs"
                variant="ghost"
                className="mt-1.5"
                onClick={() => setAberto((v) => !v)}
              >
                {aberto ? "Recolher" : "Ver tudo"}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem inteiro teor guardado nesta intimação.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ItemParte({ p }: { p: ParteAConfirmar }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function decidir(acao: "cliente" | "contraria" | "terceiro") {
    start(async () => {
      const r =
        acao === "contraria"
          ? await descartarParteAction(p.id)
          : await confirmarParteAction(p.id, {
              papel: acao === "terceiro" ? "terceiro" : (p.papelSugerido ?? undefined),
              principal: acao === "cliente",
            });
      if (r.ok) {
        toast.success(
          acao === "cliente"
            ? `${p.nome} confirmado como cliente.`
            : acao === "terceiro"
              ? `${p.nome} registrado como terceiro.`
              : `${p.nome} marcado como parte contrária.`,
        );
      } else {
        toast.error(r.erro ?? "Falha.");
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-amber-brand/40 bg-amber-tint/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{p.nome}</span>
        <Badge variant="outline" className="text-[0.6rem] uppercase">
          {rotuloPolo(p.polo)}
        </Badge>
        <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
          confiança {p.confianca}
        </Badge>
      </div>
      {p.justificativa && (
        <p className="mt-1.5 text-xs text-muted-foreground">{p.justificativa}</p>
      )}
      {p.trechoFonte && (
        <p className="mt-1.5 font-mono text-[0.7rem] text-muted-foreground">“{p.trechoFonte}”</p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button size="xs" onClick={() => decidir("cliente")} disabled={pending}>
          <Check /> É o cliente
        </Button>
        <Button size="xs" variant="outline" onClick={() => decidir("contraria")} disabled={pending}>
          <X /> É a parte contrária
        </Button>
        <Button size="xs" variant="ghost" onClick={() => decidir("terceiro")} disabled={pending}>
          <Users /> Terceiro
        </Button>
      </div>
    </li>
  );
}
