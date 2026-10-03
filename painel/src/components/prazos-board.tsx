"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Pencil, X, CalendarDays, Inbox, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StaggerGroup, StaggerItem } from "@/components/motion-primitives";
import {
  confirmarPrazoAction,
  editarPrazoAction,
  cancelarPrazoAction,
} from "@/app/actions";
import { estiloStatus, diasRestantes, urgencia, formatarData, FILTROS_PRAZO, pendenciasDoPrazo, type FiltroPrazo } from "@/lib/prazo-ui";
import type { PrazoRow } from "@/db/queries";

export function PrazosBoard({ prazos, filtro = "todos", mostrarFiltros = true }: { prazos: PrazoRow[]; filtro?: FiltroPrazo; mostrarFiltros?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // A coleta é diária (o robô roda 1x/dia). O painel atualiza quando você age (confirmar/editar)
  // ou ao recarregar a página, sem ficar consultando o banco a cada poucos segundos.

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
      else toast.error(r.erro ?? "Falha ao cancelar.");
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
          Os prazos aparecem após a coleta e a análise das intimações. Confira a fila de
          comunicações para acompanhar o que aguarda revisão.
        </p>
        <Link href="/intimacoes?filtro=sem-prazo" className="mt-4 text-sm font-medium text-indigo-brand hover:underline">Ver intimações pendentes</Link>
      </div>
    );
  }

  const selecionar = (p: PrazoRow, valor: FiltroPrazo) => {
    const dias = diasRestantes(p.dataFatal);
    if (valor === "revisao") return p.origem !== "humana";
    if (valor === "prioridade") return dias >= 0 && dias <= 7;
    if (valor === "futuros") return dias > 7;
    if (valor === "vencidos") return dias < 0;
    return true;
  };
  const filtrados = prazos.filter((p) => selecionar(p, filtro));
  const ativos = filtrados.filter((p) => diasRestantes(p.dataFatal) >= 0);
  const vencidos = filtrados.filter((p) => diasRestantes(p.dataFatal) < 0);
  const cards = (itens: PrazoRow[]) => (
    <StaggerGroup className="grid gap-3">
      {itens.map((p) => (
        <StaggerItem key={p.id}>
          <PrazoCard p={p} onConfirmar={confirmar} onCancelar={cancelar} pending={pending} />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );

  return (
    <div className="space-y-4">
      {mostrarFiltros && (
        <nav aria-label="Filtrar prazos" className="flex flex-wrap gap-2">
          {FILTROS_PRAZO.map((f) => (
            <Link key={f.valor} href={f.valor === "todos" ? "/prazos" : `/prazos?filtro=${f.valor}`} aria-current={filtro === f.valor ? "page" : undefined}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${filtro === f.valor ? "border-indigo-brand/40 bg-indigo-tint text-indigo-brand" : "bg-card text-muted-foreground hover:border-indigo-brand/30"}`}>
              {f.rotulo} <span className="ml-1 opacity-70">{prazos.filter((p) => selecionar(p, f.valor)).length}</span>
            </Link>
          ))}
        </nav>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 text-indigo-brand" />
        <span>
          coleta diária (o robô roda 1x/dia) · <span className="text-amber-brand">●</span> sugerido
          (máquina) · <span className="text-moss-brand">●</span> confirmado/editado (humano)
        </span>
      </div>
      {filtrados.length === 0 && <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nenhum prazo neste filtro.</p>}
      {vencidos.length > 0 && (
        <section aria-label="Prazos vencidos" className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div><p className="font-semibold text-destructive">{vencidos.length} prazo(s) vencido(s) aguardando conferência</p><p className="mt-0.5 text-xs text-muted-foreground">Confira se o ato foi praticado e registre a situação nas anotações do processo. A confirmação da data não encerra o prazo.</p></div>
          </div>
          {cards(vencidos)}
        </section>
      )}
      {ativos.length > 0 && <section aria-label="Prazos a vencer" className="space-y-3">{vencidos.length > 0 && <h3 className="font-serif text-lg font-semibold">Próximos vencimentos</h3>}{cards(ativos)}</section>}
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
  const pendencias = pendenciasDoPrazo(p.divergencia);
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
      {pendencias.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-brand/30 bg-amber-tint/60 p-3 text-xs text-amber-brand">
          <p className="font-semibold">Conferir antes de confirmar</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">{pendencias.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isHumano && (
          <RevisarPrazoDialog p={p} onConfirmar={onConfirmar} pending={pending} />
        )}
        <EditarPrazoDialog p={p} />
        <Button size="sm" variant="outline" render={<Link href={`/pz/${p.id}`} />}>
          <Sparkles className="mr-1 h-4 w-4" /> Abrir / gerar peça
        </Button>
        <CancelarPrazoDialog p={p} onCancelar={onCancelar} pending={pending} />
        {isHumano && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-wide text-moss-brand">
            <ShieldCheck className="h-3.5 w-3.5" /> validado
          </span>
        )}
      </div>
    </div>
  );
}

function RevisarPrazoDialog({ p, onConfirmar, pending }: { p: PrazoRow; onConfirmar: (id: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const pendencias = pendenciasDoPrazo(p.divergencia);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={pending} />}><Check className="mr-1 h-4 w-4" /> Revisar e confirmar</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Conferir prazo sugerido</DialogTitle><DialogDescription>Confira o ato, o rito e a fonte antes de assumir a data.</DialogDescription></DialogHeader>
        <dl className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div><dt className="text-xs text-muted-foreground">Ato</dt><dd className="font-medium">{p.ato}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Processo</dt><dd className="break-all font-mono text-xs">{p.numeroCnj ?? "Sem processo vinculado"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Data fatal sugerida</dt><dd className="font-semibold">{formatarData(p.dataFatal)}{p.dias ? ` · ${p.dias} dias ${p.contagem === "corridos" ? "corridos" : p.contagem === "uteis" ? "úteis" : ""}` : ""}</dd></div>
        </dl>
        {p.justificativaIa && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.justificativaIa}</p>}
        {pendencias.length > 0 && <div className="rounded-lg border border-amber-brand/30 bg-amber-tint p-3 text-sm text-amber-brand"><p className="font-semibold">Pontos a conferir</p><ul className="mt-2 list-disc space-y-1 pl-4">{pendencias.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        <DialogFooter><Button variant="outline" render={<Link href={p.comunicacaoId ? `/i/${p.comunicacaoId}` : `/pz/${p.id}`} />} onClick={() => setOpen(false)}>{p.comunicacaoId ? "Ver intimação" : "Ver detalhes"}</Button><Button disabled={pending} onClick={() => { onConfirmar(p.id); setOpen(false); }}><ShieldCheck /> Conferi e confirmo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelarPrazoDialog({ p, onCancelar, pending }: { p: PrazoRow; onCancelar: (id: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button size="sm" variant="ghost" className="text-muted-foreground" disabled={pending} />}><X className="mr-1 h-4 w-4" /> Cancelar</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cancelar este prazo?</DialogTitle><DialogDescription>{p.ato} · {formatarData(p.dataFatal)}. O prazo sai da lista ativa e dos alertas. Use esta ação quando o prazo não se aplica e registre o motivo nas anotações do processo.</DialogDescription></DialogHeader><DialogFooter showCloseButton><Button variant="destructive" disabled={pending} onClick={() => { onCancelar(p.id); setOpen(false); }}>Cancelar prazo</Button></DialogFooter></DialogContent></Dialog>;
}

function EditarPrazoDialog({ p }: { p: PrazoRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dataFatal, setDataFatal] = useState(p.dataFatal);
  const [ato, setAto] = useState(p.ato);
  const [pending, startTransition] = useTransition();

  function salvar() {
    if (!ato.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dataFatal)) {
      toast.error("Informe o ato e uma data fatal válida.");
      return;
    }
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
