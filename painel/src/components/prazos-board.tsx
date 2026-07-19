"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, X, RefreshCw, CalendarDays, Inbox, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StaggerGroup, StaggerItem } from "@/components/motion-primitives";
import {
  confirmarPrazoAction,
  editarPrazoAction,
  cancelarPrazoAction,
} from "@/app/actions";
import { estiloStatus, diasRestantes, urgencia, formatarData } from "@/lib/prazo-ui";
import type { PrazoRow } from "@/db/queries";

export function PrazosBoard({ prazos }: { prazos: PrazoRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // "acende sozinho": revalida a cada 30s buscando prazos novos gravados pelo Claude Code.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  function confirmar(id: string) {
    startTransition(async () => {
      const r = await confirmarPrazoAction(id);
      if (r.ok) toast.success("Prazo confirmado. Virou palavra final.");
      else toast.error(r.erro ?? "Falha ao confirmar.");
      router.refresh();
    });
  }

  function cancelar(id: string) {
    startTransition(async () => {
      const r = await cancelarPrazoAction(id);
      if (r.ok) toast("Prazo cancelado.");
      router.refresh();
    });
  }

  if (prazos.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-tint text-indigo-brand">
          <Inbox className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-lg font-medium">Nenhum prazo por enquanto</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          No terminal, peça ao Claude Code para{" "}
          <span className="font-mono text-foreground">buscar suas intimações</span> e calcular os
          prazos. Eles aparecem aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        <RefreshCw className={`h-3.5 w-3.5 text-indigo-brand ${pending ? "animate-spin" : ""}`} />
        <span>
          atualiza sozinho a cada 30s · <span className="text-amber-brand">●</span> sugerido (máquina)
          · <span className="text-moss-brand">●</span> confirmado/editado (humano)
        </span>
      </div>
      <StaggerGroup className="grid gap-3">
        {prazos.map((p) => (
          <StaggerItem key={p.id}>
            <PrazoCard p={p} onConfirmar={confirmar} onCancelar={cancelar} pending={pending} />
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}

function DiasBadge({ dias }: { dias: number }) {
  const critico = dias <= 1;
  const alerta = dias > 1 && dias <= 7;
  const cor = critico
    ? "border-destructive/25 bg-destructive/10 text-destructive"
    : alerta
      ? "border-amber-brand/25 bg-amber-tint text-amber-brand"
      : "border-indigo-brand/20 bg-indigo-tint text-indigo-brand";
  const numero = dias < 0 ? Math.abs(dias) : dias;
  const rotulo = dias < 0 ? "atraso" : dias === 0 ? "hoje" : dias === 1 ? "dia" : "dias";

  return (
    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${cor}`}>
      <span className="font-serif text-xl font-semibold leading-none">{dias === 0 ? "0" : numero}</span>
      <span className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-wide opacity-80">{rotulo}</span>
    </div>
  );
}

function PrazoCard({
  p,
  onConfirmar,
  onCancelar,
  pending,
}: {
  p: PrazoRow;
  onConfirmar: (id: string) => void;
  onCancelar: (id: string) => void;
  pending: boolean;
}) {
  const est = estiloStatus(p.status, p.origem);
  const dias = diasRestantes(p.dataFatal);
  const urg = urgencia(dias);
  const isHumano = p.origem === "humana";
  const barra =
    dias < 0 || dias <= 1 ? "bg-destructive" : dias <= 7 ? "bg-amber-brand" : "bg-indigo-brand";

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 pl-5 shadow-sm shadow-black/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.06]">
      <span className={`absolute left-0 top-0 h-full w-1.5 ${barra}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg font-semibold leading-tight">{p.ato}</h3>
            <Badge className={est.badge}>{est.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.clienteNome ? `${p.clienteNome} · ` : ""}
            <span className="font-mono">{p.numeroCnj ?? "processo não vinculado"}</span>
            {p.tribunal ? ` · ${p.tribunal}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-serif font-semibold">{formatarData(p.dataFatal)}</span>
            <span className={`text-xs ${urg.classe}`}>· {urg.texto}</span>
          </div>
        </div>
        <DiasBadge dias={dias} />
      </div>

      {p.justificativaIa && (
        <p className="mt-3 line-clamp-2 rounded-md border-l-2 border-indigo-brand/30 bg-muted/40 py-1.5 pl-3 pr-2 text-xs text-muted-foreground">
          {p.justificativaIa}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isHumano && (
          <Button size="sm" onClick={() => onConfirmar(p.id)} disabled={pending}>
            <Check className="mr-1 h-4 w-4" /> Confirmar
          </Button>
        )}
        <EditarPrazoDialog p={p} />
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => onCancelar(p.id)}
          disabled={pending}
        >
          <X className="mr-1 h-4 w-4" /> Cancelar
        </Button>
        {isHumano && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-wide text-moss-brand">
            <ShieldCheck className="h-3.5 w-3.5" /> validado
          </span>
        )}
      </div>
    </div>
  );
}

function EditarPrazoDialog({ p }: { p: PrazoRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dataFatal, setDataFatal] = useState(p.dataFatal);
  const [ato, setAto] = useState(p.ato);
  const [pending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await editarPrazoAction(p.id, { dataFatal, ato });
      if (r.ok) {
        toast.success("Prazo editado (origem humana).");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha ao editar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Pencil className="mr-1 h-4 w-4" /> Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Editar prazo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Ato</span>
            <Input value={ato} onChange={(e) => setAto(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Data fatal</span>
            <Input type="date" value={dataFatal} onChange={(e) => setDataFatal(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">
            Ao salvar, o prazo passa a ser <b>humano</b> e o motor não sobrescreve mais.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={pending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
