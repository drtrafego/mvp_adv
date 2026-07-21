"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarModeloAction, removerModeloAction } from "@/app/actions";
import type { ModeloRow } from "@/db/queries";

const TIPOS = [
  "inicial",
  "contestacao",
  "recurso",
  "manifestacao",
  "embargos",
  "agravo",
  "outro",
] as const;

const campo =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-brand/50";
const label = "font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground";

export function ImportarModelos({ modelos }: { modelos: ModeloRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState<string>("contestacao");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [tags, setTags] = useState("");
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");

  function salvar() {
    setErro("");
    setOk(false);
    if (!titulo.trim()) return setErro("Informe um título para o modelo.");
    if (!texto.trim()) return setErro("Cole o texto do modelo (a peça do escritório).");
    start(async () => {
      const r = await salvarModeloAction({
        tipo,
        titulo,
        textoExtraido: texto,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (r.ok) {
        setOk(true);
        setTitulo("");
        setTexto("");
        setTags("");
        router.refresh();
      } else {
        setErro(r.erro ?? "Não foi possível salvar o modelo.");
      }
    });
  }

  function remover(id: string) {
    start(async () => {
      await removerModeloAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Tipo de peça</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="ex.: Contestação padrão consumidor"
            className={campo}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>Texto do modelo</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={7}
          placeholder="Cole aqui o texto de uma peça do escritório. O redator usa como base de estrutura e estilo, nunca copia as citações (essas vêm verificadas)."
          className={`${campo} resize-y font-mono text-xs leading-relaxed`}
        />
      </label>

      <label className="block">
        <span className={label}>Tags (opcional, separadas por vírgula)</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="consumidor, dano moral, banco"
          className={campo}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={salvar} disabled={pending} className="gap-2">
          <Plus className="h-4 w-4" />
          {pending ? "Salvando..." : "Adicionar ao banco de peças"}
        </Button>
        {erro && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {erro}
          </p>
        )}
        {ok && (
          <p className="inline-flex items-center gap-2 rounded-md border border-moss-brand/40 bg-moss-tint/60 px-3 py-2 text-sm text-moss-brand">
            <CheckCircle2 className="h-4 w-4" /> Modelo adicionado.
          </p>
        )}
      </div>

      {modelos.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
            {modelos.length} modelo(s) no banco
          </p>
          <ul className="space-y-2">
            {modelos.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-brand" />
                  <span className="truncate">{m.titulo}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                    {m.tipo}
                  </span>
                </span>
                <button
                  onClick={() => remover(m.id)}
                  disabled={pending}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remover modelo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
