"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Pencil,
  ShieldCheck,
  Bot,
  Download,
  Trash2,
  Terminal,
  FileSignature,
  Gavel,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  editarPecaAction,
  confirmarPecaAction,
  removerPecaAction,
  protocolarInicialAction,
} from "@/app/actions";

export type PecaDetalhe = {
  peca: {
    id: string;
    tipo: string;
    titulo: string | null;
    conteudo: string | null;
    status: string | null;
    origem: string | null;
    criadoEm: Date | string | null;
  };
  processo: { id: string; numeroCnj: string; clienteNome: string | null } | null;
};

function comandoDaPeca(id: string, tipo: string): string {
  return (
    `Gera um rascunho de ${tipo} (peca_id ${id}). Aciona o forense: o pesquisador-juridico ` +
    `verifica os fundamentos em fonte oficial, o redator-forense redige usando os modelos do ` +
    `escritorio (buscar_modelos), o revisor-juridico audita as citacoes, e salva com a tool ` +
    `salvar_peca informando peca_id=${id}.`
  );
}

export function PecaDetalhe({ detalhe }: { detalhe: PecaDetalhe }) {
  const { peca, processo } = detalhe;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [conteudo, setConteudo] = useState(peca.conteudo ?? "");

  const isHumano = peca.origem === "humana";
  const pendente = peca.status === "pendente";
  const ehInicialSemProcesso = peca.tipo === "inicial" && !processo;
  const comando = comandoDaPeca(peca.id, peca.tipo);

  function copiarComando() {
    navigator.clipboard?.writeText(comando).then(
      () => toast.success("Comando copiado. Cole no Claude Code."),
      () => toast.error("Não consegui copiar. Selecione e copie manualmente."),
    );
  }

  function salvar() {
    start(async () => {
      const r = await editarPecaAction(peca.id, conteudo);
      if (r.ok) {
        toast.success("Peça salva (origem humana).");
        setEditando(false);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  function aprovar() {
    start(async () => {
      const r = await confirmarPecaAction(peca.id);
      if (r.ok) toast.success("Peça aprovada. Virou sua palavra.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  function remover() {
    start(async () => {
      const r = await removerPecaAction(peca.id);
      if (r.ok) {
        toast("Peça arquivada.");
        router.back();
      } else {
        toast.error(r.erro ?? "Falha.");
      }
    });
  }

  return (
    <div className="flex flex-col">
      <div className="border-b bg-muted/30 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-indigo-brand/30 bg-indigo-tint text-indigo-brand capitalize">
            {peca.tipo}
          </Badge>
          {isHumano ? (
            <Badge className="border border-moss-brand/30 bg-moss-tint text-[0.65rem] uppercase text-moss-brand">
              <ShieldCheck className="mr-1 h-3 w-3" /> aprovada
            </Badge>
          ) : (
            <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.65rem] uppercase text-amber-brand">
              <Bot className="mr-1 h-3 w-3" /> rascunho da máquina
            </Badge>
          )}
        </div>
        <h2 className="mt-2 font-serif text-xl font-semibold leading-tight">
          {peca.titulo ?? `Rascunho de ${peca.tipo}`}
        </h2>
        {processo && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {processo.clienteNome ? `${processo.clienteNome} · ` : ""}
            {processo.numeroCnj}
          </p>
        )}
      </div>

      <div className="px-4 py-5 sm:px-6">
        {pendente ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-brand/30 bg-amber-tint/40 p-4">
              <p className="flex items-center gap-2 font-serif text-sm font-semibold text-amber-brand">
                <Terminal className="h-4 w-4" /> Gere este rascunho no Claude Code
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                A máquina só redige sob a trava de citações (pesquisador e revisor). Copie o comando
                abaixo e cole no Claude Code do gabinete. Quando terminar, o rascunho aparece aqui.
              </p>
            </div>
            {peca.conteudo && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                  Briefing do caso
                </p>
                <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed">
                  {peca.conteudo}
                </pre>
              </div>
            )}
            <div className="rounded-lg border bg-card p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground">
                {comando}
              </pre>
            </div>
            <Button onClick={copiarComando} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar comando
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {editando ? (
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={20}
                className="resize-y font-mono text-xs leading-relaxed"
              />
            ) : (
              <div className="max-h-[55vh] overflow-y-auto rounded-lg border bg-card p-4">
                <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed">
                  {peca.conteudo}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {editando ? (
                <>
                  <Button size="sm" onClick={salvar} disabled={pending}>
                    <Check /> Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(false);
                      setConteudo(peca.conteudo ?? "");
                    }}
                    disabled={pending}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                    <Pencil /> Editar
                  </Button>
                  {!isHumano && (
                    <Button size="sm" onClick={aprovar} disabled={pending}>
                      <ShieldCheck /> Aprovar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    render={<a href={`/pe/${peca.id}/docx`} download />}
                  >
                    <Download /> Baixar (Word)
                  </Button>
                  {ehInicialSemProcesso && (
                    <ProtocolarBtn pecaId={peca.id} clienteNome={peca.titulo} />
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-muted-foreground"
                onClick={remover}
                disabled={pending}
              >
                <Trash2 /> Arquivar
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5" />
              Rascunho sugerido pela máquina. Revise, ajuste e assine antes de protocolar. A
              responsabilidade é do advogado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProtocolarBtn({ pecaId, clienteNome }: { pecaId: string; clienteNome: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [numeroCnj, setNumeroCnj] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [nome, setNome] = useState((clienteNome ?? "").replace(/^Inicial\s*[—-]\s*/, ""));
  const [pending, start] = useTransition();

  function protocolar() {
    if (!numeroCnj.trim() || !tribunal.trim()) {
      toast.error("Informe o número CNJ e o tribunal.");
      return;
    }
    start(async () => {
      const r = await protocolarInicialAction(pecaId, {
        numeroCnj,
        tribunal,
        clienteNome: nome,
      });
      if (r.ok && r.processoId) {
        toast.success("Processo criado na carteira.");
        setOpen(false);
        router.push(`/p/${r.processoId}`);
      } else {
        toast.error(r.erro ?? "Falha ao protocolar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Gavel /> Protocolei, criar processo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Registrar o processo na carteira</DialogTitle>
          <DialogDescription>
            O Gabinete não protocola no tribunal, isso é seu. Depois de protocolar a inicial, informe
            o número CNJ para o caso entrar na carteira e na coleta diária.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Número CNJ</span>
            <Input value={numeroCnj} onChange={(e) => setNumeroCnj(e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tribunal</span>
            <Input value={tribunal} onChange={(e) => setTribunal(e.target.value)} placeholder="ex.: TJMT" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Cliente</span>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={protocolar} disabled={pending}>
            <Gavel /> Criar processo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
