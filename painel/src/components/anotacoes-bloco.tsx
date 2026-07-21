"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { editarAnotacaoAction, removerAnotacaoAction } from "@/app/actions";

type Anotacao = { id: string; texto: string; criadoEm: Date | string | null };
type AddResult = { ok: boolean; erro?: string };

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

/**
 * Bloco de anotações reutilizável (cliente, prazo). O alvo é resolvido pela action
 * `onAdd` que o pai passa; editar e remover são por id (agnósticos ao alvo).
 */
export function AnotacoesBloco({
  anotacoes,
  onAdd,
  placeholder = "Nova anotação",
}: {
  anotacoes: Anotacao[];
  onAdd: (texto: string) => Promise<AddResult>;
  placeholder?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [texto, setTexto] = useState("");

  function adicionar() {
    if (!texto.trim()) {
      toast.error("Escreva algo antes de salvar.");
      return;
    }
    start(async () => {
      const r = await onAdd(texto);
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
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} />
        <Button size="sm" onClick={adicionar} disabled={pending}>
          <Plus /> Adicionar anotação
        </Button>
      </div>

      {anotacoes.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
          Sem anotações ainda.
        </div>
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
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(a.texto);

  function salvar() {
    start(async () => {
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
    start(async () => {
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
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                onClick={remover}
                disabled={pending}
              >
                <X /> Remover
              </Button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}
