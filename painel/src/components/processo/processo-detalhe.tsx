"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Trash2,
  Check,
  Pencil,
  X,
  CalendarDays,
  Plus,
  Cog,
  User,
  Bot,
  FileText,
  StickyNote,
  Clock,
  Layers,
  Upload,
  Download,
  ShieldCheck,
  History,
  Inbox,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { estiloStatus, diasRestantes, urgencia, formatarData } from "@/lib/prazo-ui";
import {
  mudarFaseAction,
  adicionarMovimentacaoManualAction,
  editarMovimentacaoAction,
  removerMovimentacaoAction,
  adicionarAnotacaoAction,
  editarAnotacaoAction,
  removerAnotacaoAction,
  salvarClienteAction,
  arquivarProcessoAction,
  desarquivarProcessoAction,
  excluirProcessoAction,
  confirmarPrazoAction,
  editarPrazoAction,
  cancelarPrazoAction,
  confirmarParteAction,
  descartarParteAction,
} from "@/app/actions";
import { rotuloPolo } from "@/lib/partes";
import { UploadDocumento } from "@/components/processo/upload-documento";
import { CATEGORIAS } from "@/lib/documentos";
import { excluirDocumentoAction } from "@/app/(app)/p/[id]/documentos/actions";
import type { DetalheProcesso } from "@/db/queries";

type Prazo = DetalheProcesso["prazos"][number];
type Movimentacao = DetalheProcesso["movimentacoes"][number];
type Documento = DetalheProcesso["documentos"][number];
type Anotacao = DetalheProcesso["anotacoes"][number];
type Parte = DetalheProcesso["partes"][number];
type ParteDetectada = DetalheProcesso["partesDetectadas"][number];
type FaseHist = DetalheProcesso["fases"][number];

const FASES = [
  { value: "postulatoria", label: "Postulatória" },
  { value: "contestacao", label: "Contestação" },
  { value: "saneamento", label: "Saneamento" },
  { value: "instrucao", label: "Instrução" },
  { value: "sentenca", label: "Sentença" },
  { value: "recurso", label: "Recurso" },
  { value: "cumprimento", label: "Cumprimento" },
  { value: "arquivado", label: "Arquivado" },
] as const;

const PAPEIS = [
  { value: "autor", label: "Autor" },
  { value: "reu", label: "Réu" },
  { value: "terceiro", label: "Terceiro interessado" },
  { value: "advogado_contrario", label: "Advogado contrário" },
  { value: "testemunha", label: "Testemunha" },
];

const TIPOS_DOC = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "outro", label: "Outro" },
];

function faseLabel(v: string | null): string {
  return FASES.find((f) => f.value === v)?.label ?? v ?? "sem fase";
}

function formatarDataHora(d: Date | string | null): string {
  if (!d) return "-";
  const data = new Date(d);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProcessoDetalhe({ detalhe }: { detalhe: DetalheProcesso }) {
  const { processo } = detalhe;

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        <Cabecalho detalhe={detalhe} />

        <Tabs defaultValue="prazos" className="px-4 pb-6 sm:px-6">
          <TabsList variant="line" className="mb-4 flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="prazos">
              <Clock /> Prazos
            </TabsTrigger>
            <TabsTrigger value="tudo">
              <History /> Tudo
            </TabsTrigger>
            <TabsTrigger value="estagio">
              <Cog /> Estágio
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Layers /> Timeline
            </TabsTrigger>
            <TabsTrigger value="documentos">
              <FileText /> Documentos
            </TabsTrigger>
            <TabsTrigger value="anotacoes">
              <StickyNote /> Anotações
            </TabsTrigger>
            <TabsTrigger value="cliente">
              <User /> Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prazos">
            <AbaPrazos prazos={detalhe.prazos} />
          </TabsContent>
          <TabsContent value="tudo">
            <AbaTudo detalhe={detalhe} />
          </TabsContent>
          <TabsContent value="estagio">
            <AbaEstagio processoId={processo.id} faseAtual={processo.fase} fases={detalhe.fases} />
          </TabsContent>
          <TabsContent value="timeline">
            <AbaTimeline processoId={processo.id} movimentacoes={detalhe.movimentacoes} />
          </TabsContent>
          <TabsContent value="documentos">
            <AbaDocumentos processoId={processo.id} numeroCnj={processo.numeroCnj} documentos={detalhe.documentos} />
          </TabsContent>
          <TabsContent value="anotacoes">
            <AbaAnotacoes processoId={processo.id} anotacoes={detalhe.anotacoes} />
          </TabsContent>
          <TabsContent value="cliente">
            <AbaCliente
              processoId={processo.id}
              partes={detalhe.partes}
              detectadas={detalhe.partesDetectadas}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Cabeçalho
// ============================================================================

function Cabecalho({ detalhe }: { detalhe: DetalheProcesso }) {
  const { processo } = detalhe;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const arquivado = processo.status === "arquivado";

  function toggleArquivo() {
    startTransition(async () => {
      const r = arquivado
        ? await desarquivarProcessoAction(processo.id)
        : await arquivarProcessoAction(processo.id);
      if (r.ok) toast.success(arquivado ? "Processo desarquivado." : "Processo arquivado.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <div className="border-b bg-muted/30 px-4 pb-4 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-indigo-tint text-indigo-brand border border-indigo-brand/30">
          {faseLabel(processo.fase)}
        </Badge>
        <Badge variant="outline" className="text-[0.65rem] uppercase">
          {processo.status ?? "ativo"}
        </Badge>
      </div>
      <h2 className="mt-2 flex flex-wrap items-center gap-2 font-serif text-xl font-semibold leading-tight">
        {processo.clienteNome ?? "sem cliente"}
        {/* Amarelo: o cliente veio do polo único das intimações, ninguém confirmou ainda. */}
        {detalhe.partes.length > 0 && detalhe.partes.every((p) => p.parte.origem === "maquina") && (
          <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
            <Bot className="mr-1 h-3 w-3" /> cliente sugerido
          </Badge>
        )}
      </h2>
      <p className="mt-1 font-mono text-sm text-muted-foreground">{processo.numeroCnj}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {[processo.classe, processo.tribunal, processo.orgaoJulgador].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={toggleArquivo} disabled={pending}>
          {arquivado ? (
            <>
              <ArchiveRestore /> Desarquivar
            </>
          ) : (
            <>
              <Archive /> Arquivar
            </>
          )}
        </Button>
        <ExcluirDialog processoId={processo.id} numeroCnj={processo.numeroCnj} />
      </div>
    </div>
  );
}

function ExcluirDialog({ processoId, numeroCnj }: { processoId: string; numeroCnj: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirma, setConfirma] = useState("");
  const [pending, startTransition] = useTransition();
  const podeExcluir = confirma.trim() === numeroCnj.trim();

  function excluir() {
    if (!podeExcluir) return;
    startTransition(async () => {
      const r = await excluirProcessoAction(processoId);
      if (r.ok) {
        toast.success("Processo excluído. Recuperável por 30 dias.");
        setOpen(false);
        router.push("/");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha ao excluir.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        <Trash2 /> Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Excluir processo</DialogTitle>
          <DialogDescription>
            Soft-delete: some da carteira, mas é recuperável por 30 dias. Para confirmar, digite o
            número do processo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <span className="block font-mono text-xs text-muted-foreground">{numeroCnj}</span>
          <Input
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            placeholder="Digite o número para confirmar"
          />
        </div>
        <DialogFooter showCloseButton>
          <Button variant="destructive" onClick={excluir} disabled={!podeExcluir || pending}>
            Excluir mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Aba Prazos
// ============================================================================

function AbaPrazos({ prazos }: { prazos: Prazo[] }) {
  if (prazos.length === 0) {
    return <Vazio texto="Nenhum prazo neste processo. Peça ao Claude Code para buscar as intimações e calcular os prazos." />;
  }
  return (
    <div className="space-y-3">
      {prazos.map((p) => (
        <PrazoItem key={p.id} p={p} />
      ))}
    </div>
  );
}

function PrazoItem({ p }: { p: Prazo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [ato, setAto] = useState(p.ato);
  const [dataFatal, setDataFatal] = useState(p.dataFatal);

  const est = estiloStatus(p.status ?? "sugerido", p.origem ?? "maquina");
  const dias = diasRestantes(p.dataFatal);
  const urg = urgencia(dias);
  const isHumano = p.origem === "humana";
  const barra =
    dias < 0 || dias <= 1 ? "bg-destructive" : dias <= 7 ? "bg-amber-brand" : "bg-indigo-brand";

  function confirmar() {
    startTransition(async () => {
      const r = await confirmarPrazoAction(p.id);
      if (r.ok) toast.success("Prazo confirmado. Virou palavra final.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  function cancelar() {
    startTransition(async () => {
      const r = await cancelarPrazoAction(p.id);
      if (r.ok) toast("Prazo cancelado.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  function salvar() {
    startTransition(async () => {
      const r = await editarPrazoAction(p.id, { dataFatal, ato });
      if (r.ok) {
        toast.success("Prazo editado (origem humana).");
        setEditando(false);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5">
      <span className={`absolute left-0 top-0 h-full w-1.5 ${barra}`} aria-hidden />
      {editando ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Ato</span>
            <Input value={ato} onChange={(e) => setAto(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Data fatal</span>
            <Input type="date" value={dataFatal} onChange={(e) => setDataFatal(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={pending}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base font-semibold leading-tight">{p.ato}</h3>
            <Badge className={est.badge}>{est.label}</Badge>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-serif font-semibold">{formatarData(p.dataFatal)}</span>
            <span className={`text-xs ${urg.classe}`}>· {urg.texto}</span>
          </div>
          {p.justificativaIa && (
            <p className="mt-2 line-clamp-2 rounded-md border-l-2 border-indigo-brand/30 bg-muted/40 py-1.5 pl-3 pr-2 text-xs text-muted-foreground">
              {p.justificativaIa}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isHumano && (
              <Button size="sm" onClick={confirmar} disabled={pending}>
                <Check /> Confirmar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
              <Pencil /> Editar
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={cancelar} disabled={pending}>
              <X /> Cancelar
            </Button>
            {isHumano && (
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-wide text-moss-brand">
                <ShieldCheck className="h-3.5 w-3.5" /> validado
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Aba Tudo (timeline unificada: movimentações + intimações + peças + anotações)
// ============================================================================

function AbaTudo({ detalhe }: { detalhe: DetalheProcesso }) {
  type Evento = {
    data: Date | null;
    tipo: string;
    cor: string;
    icone: React.ReactNode;
    texto: string;
    href?: string;
  };
  const eventos: Evento[] = [];

  for (const m of detalhe.movimentacoes) {
    eventos.push({
      data: m.dataHora ? new Date(m.dataHora) : null,
      tipo: m.fonte === "manual" ? "andamento" : "DataJud",
      cor: "bg-indigo-brand",
      icone: m.fonte === "manual" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />,
      texto: m.descricao,
    });
  }
  for (const c of detalhe.comunicacoes) {
    eventos.push({
      data: c.dataDisponibilizacao ? new Date(c.dataDisponibilizacao) : null,
      tipo: "intimação",
      cor: "bg-amber-brand",
      icone: <Inbox className="h-3 w-3" />,
      texto: (c.tipo ?? "Comunicação") + (c.inteiroTeor ? ` — ${c.inteiroTeor.slice(0, 140)}` : ""),
    });
  }
  for (const p of detalhe.pecas) {
    eventos.push({
      data: p.criadoEm ? new Date(p.criadoEm) : null,
      tipo: "peça",
      cor: "bg-moss-brand",
      icone: <Sparkles className="h-3 w-3" />,
      texto: p.titulo ?? `Rascunho de ${p.tipo}`,
      href: `/pe/${p.id}`,
    });
  }
  for (const a of detalhe.anotacoes) {
    eventos.push({
      data: a.criadoEm ? new Date(a.criadoEm) : null,
      tipo: "anotação",
      cor: "bg-muted-foreground",
      icone: <StickyNote className="h-3 w-3" />,
      texto: a.texto,
    });
  }

  eventos.sort((x, y) => (y.data?.getTime() ?? 0) - (x.data?.getTime() ?? 0));

  if (eventos.length === 0) {
    return (
      <Vazio texto="Sem eventos ainda. Movimentações, intimações, peças e anotações aparecem aqui juntas, em ordem." />
    );
  }

  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {eventos.map((e, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full ${e.cor}`} />
          <div className="flex items-center gap-1.5 font-mono text-[0.7rem] text-muted-foreground">
            {e.icone} {formatarDataHora(e.data)} · {e.tipo}
          </div>
          {e.href ? (
            <Link href={e.href} className="mt-0.5 block text-sm hover:underline">
              {e.texto}
            </Link>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{e.texto}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ============================================================================
// Aba Estágio
// ============================================================================

function AbaEstagio({
  processoId,
  faseAtual,
  fases,
}: {
  processoId: string;
  faseAtual: string | null;
  fases: FaseHist[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mudar(fase: string) {
    if (fase === faseAtual) return;
    startTransition(async () => {
      const r = await mudarFaseAction(processoId, fase);
      if (r.ok) toast.success(`Fase alterada para ${faseLabel(fase)}.`);
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm text-muted-foreground">Fase atual</span>
        <Select
          value={faseAtual ?? undefined}
          onValueChange={(v) => mudar(v as string)}
          items={FASES as unknown as { value: string; label: string }[]}
          disabled={pending}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Escolha a fase" />
          </SelectTrigger>
          <SelectContent>
            {FASES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Histórico de fases
        </span>
        {fases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem mudanças de fase registradas ainda.</p>
        ) : (
          <ol className="space-y-2 border-l border-border pl-4">
            {[...fases].reverse().map((f) => (
              <li key={f.id} className="relative">
                <span className="absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full bg-indigo-brand" />
                <div className="text-sm">
                  <span className="font-medium">{faseLabel(f.fase)}</span>
                  {f.faseAnterior && (
                    <span className="text-muted-foreground"> · antes: {faseLabel(f.faseAnterior)}</span>
                  )}
                </div>
                <div className="font-mono text-[0.7rem] text-muted-foreground">
                  {formatarDataHora(f.criadoEm)} · {f.autor ?? "sistema"}
                </div>
                {f.motivo && <p className="mt-0.5 text-xs text-muted-foreground">{f.motivo}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Aba Timeline
// ============================================================================

function AbaTimeline({
  processoId,
  movimentacoes,
}: {
  processoId: string;
  movimentacoes: Movimentacao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [descricao, setDescricao] = useState("");
  const [dataHora, setDataHora] = useState("");

  function adicionar() {
    if (!descricao.trim() || !dataHora) {
      toast.error("Preencha descrição e data.");
      return;
    }
    startTransition(async () => {
      const r = await adicionarMovimentacaoManualAction(processoId, { descricao, dataHora });
      if (r.ok) {
        toast.success("Andamento adicionado.");
        setDescricao("");
        setDataHora("");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/30 p-3">
        <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Adicionar andamento manual
        </span>
        <div className="space-y-2">
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição do andamento"
            className="min-h-14"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              className="sm:w-56"
            />
            <Button size="sm" onClick={adicionar} disabled={pending}>
              <Plus /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      {movimentacoes.length === 0 ? (
        <Vazio texto="Sem movimentações. As automáticas chegam do DataJud; as manuais você adiciona acima." />
      ) : (
        <ol className="space-y-2 border-l border-border pl-4">
          {movimentacoes.map((m) => (
            <MovimentacaoItem key={m.id} m={m} />
          ))}
        </ol>
      )}
    </div>
  );
}

function MovimentacaoItem({ m }: { m: Movimentacao }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(m.descricao);
  const manual = m.fonte === "manual";

  function salvar() {
    startTransition(async () => {
      const r = await editarMovimentacaoAction(m.id, { descricao });
      if (r.ok) {
        toast.success("Andamento editado.");
        setEditando(false);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  function remover() {
    startTransition(async () => {
      const r = await removerMovimentacaoAction(m.id);
      if (r.ok) toast("Andamento removido.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <li className="relative">
      <span
        className={`absolute -left-[1.30rem] top-1.5 h-2 w-2 rounded-full ${
          manual ? "bg-amber-brand" : "bg-indigo-brand"
        }`}
      />
      <div className="flex items-center gap-1.5 font-mono text-[0.7rem] text-muted-foreground">
        {manual ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        {formatarDataHora(m.dataHora)} · {manual ? "manual" : "DataJud"}
      </div>
      {editando ? (
        <div className="mt-1.5 space-y-2">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-14" />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={pending}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-sm">{m.descricao}</p>
          {manual && (
            <div className="mt-1 flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={() => setEditando(true)}>
                <Pencil /> Editar
              </Button>
              <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={remover} disabled={pending}>
                <X /> Remover
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

// ============================================================================
// Aba Documentos
// ============================================================================

function AbaDocumentos({
  processoId,
  numeroCnj,
  documentos,
}: {
  processoId: string;
  numeroCnj: string;
  documentos: Documento[];
}) {
  // Agrupa por categoria na ordem processual: é a divisão das peças por tipo dentro do processo.
  const grupos = CATEGORIAS.map((c) => ({
    categoria: c,
    itens: documentos.filter((d) => (d.categoria ?? "outro") === c.valor),
  })).filter((g) => g.itens.length > 0);
  const semCategoria = documentos.filter(
    (d) => !CATEGORIAS.some((c) => c.valor === (d.categoria ?? "outro")),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {documentos.length} documento{documentos.length === 1 ? "" : "s"}
        </span>
        <UploadDocumento processoId={processoId} numeroCnj={numeroCnj} />
      </div>

      {documentos.length === 0 ? (
        <Vazio texto="Nenhum documento. Envie aqui, ou peça no terminal: anexa esse PDF no processo." />
      ) : (
        <div className="space-y-5">
          {[...grupos, ...(semCategoria.length ? [{ categoria: null, itens: semCategoria }] : [])].map(
            (g) => (
              <section key={g.categoria?.valor ?? "sem-categoria"}>
                <h4 className="mb-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {g.categoria?.rotulo ?? "Sem categoria"} · {g.itens.length}
                </h4>
                <ul className="space-y-2">
                  {g.itens.map((d) => (
                    <ItemDocumento key={d.id} processoId={processoId} documento={d} />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Estado do texto extraído: é o que diz se o squad consegue ler o documento. */
function chipTexto(status: string | null) {
  if (status === "ok") return { txt: "texto ok", cls: "bg-moss-tint text-moss-brand" };
  if (status === "sem_texto") return { txt: "sem texto (OCR)", cls: "bg-amber-tint text-amber-brand" };
  if (status === "falhou") return { txt: "falha na leitura", cls: "bg-destructive/10 text-destructive" };
  if (status === "nao_aplica") return null;
  return { txt: "processando", cls: "bg-muted text-muted-foreground" };
}

function ItemDocumento({ processoId, documento: d }: { processoId: string; documento: Documento }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const chip = chipTexto(d.extracaoStatus ?? null);

  function excluir() {
    startTransition(async () => {
      const r = await excluirDocumentoAction(d.id, processoId);
      if (r.ok) toast.success("Documento removido da lista.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{d.titulo ?? "documento sem título"}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {d.tamanhoBytes ? <span>{(d.tamanhoBytes / 1024).toFixed(0)} KB</span> : null}
          {d.paginas ? <span>· {d.paginas} p.</span> : null}
          <span>
            ·{" "}
            {formatarData(d.dataDocumento) !== "-"
              ? formatarData(d.dataDocumento)
              : formatarDataHora(d.createdAt)}
          </span>
          {chip && (
            <span className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] uppercase ${chip.cls}`}>
              {chip.txt}
            </span>
          )}
        </div>
        {d.descricao && <p className="mt-1 text-xs text-muted-foreground">{d.descricao}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" render={<a href={`/p/${processoId}/doc/${d.id}`} />}>
          <Download className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={excluir} disabled={pending}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

// ============================================================================
// Aba Anotações
// ============================================================================

function AbaAnotacoes({ processoId, anotacoes }: { processoId: string; anotacoes: Anotacao[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");

  function adicionar() {
    if (!texto.trim()) {
      toast.error("Escreva algo antes de salvar.");
      return;
    }
    startTransition(async () => {
      const r = await adicionarAnotacaoAction(processoId, texto);
      if (r.ok) {
        toast.success("Anotação salva.");
        setTexto("");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nova anotação sobre o processo"
        />
        <Button size="sm" onClick={adicionar} disabled={pending}>
          <Plus /> Adicionar anotação
        </Button>
      </div>

      {anotacoes.length === 0 ? (
        <Vazio texto="Sem anotações ainda." />
      ) : (
        <ul className="space-y-2">
          {anotacoes.map((a) => (
            <AnotacaoItem key={a.id} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AnotacaoItem({ a }: { a: Anotacao }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(a.texto);

  function salvar() {
    startTransition(async () => {
      const r = await editarAnotacaoAction(a.id, texto);
      if (r.ok) {
        toast.success("Anotação editada.");
        setEditando(false);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  function remover() {
    startTransition(async () => {
      const r = await removerAnotacaoAction(a.id);
      if (r.ok) toast("Anotação removida.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border bg-card p-3">
      {editando ? (
        <div className="space-y-2">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={pending}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{a.texto}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[0.7rem] text-muted-foreground">
              {formatarDataHora(a.criadoEm)}
            </span>
            <div className="flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={() => setEditando(true)}>
                <Pencil /> Editar
              </Button>
              <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={remover} disabled={pending}>
                <X /> Remover
              </Button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

// ============================================================================
// Aba Cliente
// ============================================================================

function AbaCliente({
  processoId,
  partes,
  detectadas,
}: {
  processoId: string;
  partes: Parte[];
  detectadas: ParteDetectada[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const principal = partes.find((p) => p.parte.principal) ?? partes[0];
  const cli = principal?.cliente ?? null;

  const [nome, setNome] = useState(cli?.nome ?? "");
  const [documento, setDocumento] = useState(cli?.documento ?? "");
  const [tipoDocumento, setTipoDocumento] = useState(cli?.tipoDocumento ?? "cpf");
  const [email, setEmail] = useState(cli?.email ?? "");
  const [telefone, setTelefone] = useState(cli?.telefone ?? "");
  const [papel, setPapel] = useState(principal?.parte.papel ?? "autor");

  function salvar() {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    startTransition(async () => {
      const r = await salvarClienteAction(
        processoId,
        {
          id: cli?.id,
          nome,
          documento,
          tipoDocumento,
          email,
          telefone,
          principal: true,
        },
        papel,
      );
      if (r.ok) toast.success("Cliente salvo.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  const pendentes = detectadas.filter((d) => d.status === "sugerido");

  return (
    <div className="space-y-5">
      {partes.length > 0 && (
        <div>
          <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Partes vinculadas
          </span>
          <ul className="space-y-1.5">
            {partes.map((p) => {
              const daMaquina = p.parte.origem === "maquina";
              return (
                <li
                  key={p.parte.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    daMaquina ? "border-amber-brand/40 bg-amber-tint/40" : "bg-card"
                  }`}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{p.cliente?.nome ?? "sem cadastro"}</span>
                  <Badge variant="outline" className="text-[0.6rem] uppercase">
                    {p.parte.papel}
                  </Badge>
                  {p.parte.principal && (
                    <Badge className="bg-moss-tint text-moss-brand border border-moss-brand/30 text-[0.6rem] uppercase">
                      principal
                    </Badge>
                  )}
                  {daMaquina ? (
                    <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
                      <Bot className="mr-1 h-3 w-3" /> sugerido
                    </Badge>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wide text-moss-brand">
                      <ShieldCheck className="h-3.5 w-3.5" /> confirmado
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pendentes.length > 0 && (
        <div>
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-amber-brand">
            Reconhecidas a confirmar · {pendentes.length}
          </span>
          <p className="mb-2 text-xs text-muted-foreground">
            Lidas dos destinatários das intimações. Enquanto o processo tem intimação dos dois
            polos, nada vira cliente sozinho: quem diz de que lado o escritório está é você.
          </p>
          <ul className="space-y-2">
            {pendentes.map((d) => (
              <ParteDetectadaItem key={d.id} d={d} />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
        <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {cli ? "Editar cliente principal" : "Cadastrar cliente"}
        </span>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Nome</span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Documento</span>
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo de documento</span>
            <Select
              value={tipoDocumento}
              onValueChange={(v) => setTipoDocumento(v as string)}
              items={TIPOS_DOC}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOC.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">E-mail</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Telefone</span>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Papel no processo</span>
            <Select value={papel} onValueChange={(v) => setPapel(v as string)} items={PAPEIS}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPEIS.map((pp) => (
                  <SelectItem key={pp.value} value={pp.value}>
                    {pp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <Button size="sm" onClick={salvar} disabled={pending}>
          <Check /> Salvar cliente
        </Button>
      </div>
    </div>
  );
}

/**
 * Uma parte que a máquina reconheceu e ninguém confirmou. Três saídas, todas do advogado: é o
 * cliente (vira vínculo humano principal), é a parte contrária (some, e o vínculo que a máquina
 * tiver criado é removido) ou é terceiro (vínculo humano, mas não é o cliente do processo).
 */
function ParteDetectadaItem({ d }: { d: ParteDetectada }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decidir(acao: "cliente" | "contraria" | "terceiro") {
    startTransition(async () => {
      const r =
        acao === "contraria"
          ? await descartarParteAction(d.id)
          : await confirmarParteAction(d.id, {
              papel: acao === "terceiro" ? "terceiro" : (d.papelSugerido ?? undefined),
              principal: acao === "cliente",
            });
      if (r.ok) {
        toast.success(
          acao === "cliente"
            ? `${d.nome} confirmado como cliente.`
            : acao === "terceiro"
              ? `${d.nome} registrado como terceiro.`
              : `${d.nome} marcado como parte contrária.`,
        );
      } else {
        toast.error(r.erro ?? "Falha.");
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-amber-brand/40 bg-amber-tint/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{d.nome}</span>
        <Badge variant="outline" className="text-[0.6rem] uppercase">
          {rotuloPolo(d.polo)}
        </Badge>
        <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
          <Bot className="mr-1 h-3 w-3" /> confiança {d.confianca}
        </Badge>
        {d.eClienteSugerido && (
          <Badge variant="outline" className="text-[0.6rem] uppercase">
            já gravado como sugestão
          </Badge>
        )}
      </div>
      {d.justificativa && (
        <p className="mt-1.5 rounded-md border-l-2 border-amber-brand/40 bg-card/60 py-1.5 pl-3 pr-2 text-xs text-muted-foreground">
          {d.justificativa}
        </p>
      )}
      {d.trechoFonte && (
        <p className="mt-1.5 line-clamp-3 font-mono text-[0.7rem] text-muted-foreground">
          “{d.trechoFonte}”
        </p>
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

// ============================================================================
// Comuns
// ============================================================================

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}
