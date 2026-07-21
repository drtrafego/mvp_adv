"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  StickyNote,
  FileText,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { estiloStatus, diasRestantes, urgencia, formatarData } from "@/lib/prazo-ui";
import { AnotacoesBloco } from "@/components/anotacoes-bloco";
import {
  confirmarPrazoAction,
  gerarPecaAction,
  adicionarAnotacaoPrazoAction,
} from "@/app/actions";
import type { DetalhePrazo } from "@/db/queries";

const TIPOS_PECA = [
  { value: "contestacao", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "manifestacao", label: "Manifestação" },
  { value: "embargos", label: "Embargos de declaração" },
  { value: "agravo", label: "Agravo" },
  { value: "peticao", label: "Petição / outra" },
];

type Peca = DetalhePrazo["pecas"][number];

export function PrazoDetalhe({ detalhe }: { detalhe: DetalhePrazo }) {
  const { prazo, processo, anotacoes, pecas } = detalhe;
  const est = estiloStatus(prazo.status ?? "sugerido", prazo.origem ?? "maquina");
  const dias = diasRestantes(prazo.dataFatal);
  const urg = urgencia(dias);
  const isHumano = prazo.origem === "humana";

  return (
    <div className="flex flex-col">
      <div className="border-b bg-muted/30 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={est.badge}>{est.label}</Badge>
          {isHumano && (
            <Badge className="border border-moss-brand/30 bg-moss-tint text-[0.65rem] uppercase text-moss-brand">
              <ShieldCheck className="mr-1 h-3 w-3" /> validado
            </Badge>
          )}
        </div>
        <h2 className="mt-2 font-serif text-xl font-semibold leading-tight">{prazo.ato}</h2>
        {processo && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {processo.clienteNome ? `${processo.clienteNome} · ` : ""}
            {processo.numeroCnj}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-sm">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-serif font-semibold">{formatarData(prazo.dataFatal)}</span>
          <span className={`text-xs ${urg.classe}`}>· {urg.texto}</span>
        </div>

        {dias >= 0 && dias <= 5 && (
          <p className="mt-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            Prazo curto ({dias === 0 ? "vence hoje" : `faltam ${dias} dia(s)`}). Confira e aja com
            urgência.
          </p>
        )}

        {prazo.justificativaIa && (
          <p className="mt-2 rounded-md border-l-2 border-indigo-brand/30 bg-muted/40 py-1.5 pl-3 pr-2 text-xs text-muted-foreground">
            {prazo.justificativaIa}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!isHumano && <ConfirmarBtn id={prazo.id} />}
          <GerarPecaDialog prazoId={prazo.id} processoId={prazo.processoId} />
          {processo && (
            <Button size="sm" variant="ghost" render={<Link href={`/p/${processo.id}`} />}>
              <ExternalLink /> Ver processo
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="pecas" className="px-4 pb-6 sm:px-6">
        <TabsList variant="line" className="mb-4 flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="pecas">
            <FileText /> Peças
          </TabsTrigger>
          <TabsTrigger value="anotacoes">
            <StickyNote /> Anotações
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pecas">
          <PecasVinculadas pecas={pecas} />
        </TabsContent>
        <TabsContent value="anotacoes">
          <AnotacoesBloco
            anotacoes={anotacoes}
            onAdd={(t) => adicionarAnotacaoPrazoAction(prazo.id, t)}
            placeholder="Nota sobre este prazo"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfirmarBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function confirmar() {
    start(async () => {
      const r = await confirmarPrazoAction(id);
      if (r.ok) toast.success("Prazo confirmado. Virou palavra final.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }
  return (
    <Button size="sm" onClick={confirmar} disabled={pending}>
      <Check /> Confirmar prazo
    </Button>
  );
}

function GerarPecaDialog({
  prazoId,
  processoId,
}: {
  prazoId: string;
  processoId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("contestacao");
  const [pending, start] = useTransition();

  function gerar() {
    start(async () => {
      const r = await gerarPecaAction({
        tipo,
        prazoId,
        processoId: processoId ?? undefined,
      });
      if (r.ok && r.id) {
        toast.success("Peça criada. Siga o comando para gerar o rascunho.");
        setOpen(false);
        router.push(`/pe/${r.id}`);
      } else {
        toast.error(r.erro ?? "Falha ao criar a peça.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Sparkles /> Gerar peça
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Gerar peça deste prazo</DialogTitle>
          <DialogDescription>
            Escolha o tipo. A peça nasce como rascunho da máquina, sob a trava de citações
            (pesquisador e revisor). Você revisa, edita e assina.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <span className="block text-sm text-muted-foreground">Tipo de peça</span>
          <Select
            value={tipo}
            onValueChange={(v) => setTipo(v as string)}
            items={TIPOS_PECA}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_PECA.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={gerar} disabled={pending}>
            <Sparkles /> Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PecasVinculadas({ pecas }: { pecas: Peca[] }) {
  if (pecas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhuma peça gerada para este prazo ainda. Use &quot;Gerar peça&quot; acima.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {pecas.map((p) => (
        <li key={p.id}>
          <Link
            href={`/pe/${p.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-indigo-brand" />
              <span className="truncate capitalize">{p.titulo ?? p.tipo}</span>
            </span>
            {p.origem === "humana" ? (
              <Badge className="shrink-0 border border-moss-brand/30 bg-moss-tint text-[0.6rem] uppercase text-moss-brand">
                aprovada
              </Badge>
            ) : (
              <Badge className="shrink-0 border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
                <Bot className="mr-1 h-3 w-3" /> {p.status}
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
