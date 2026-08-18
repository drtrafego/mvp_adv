import { ArrowRight, Check, Clock, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { confirmarAnaliseAction, descartarAnaliseAction } from "@/app/(app)/intimacoes/actions";
import { estiloSeveridade, seloResultado } from "@/lib/analise-ui";
import type { AnaliseItem } from "@/db/queries";

/**
 * A leitura que a máquina fez de uma intimação ou documento, com a marca de que é SUGESTÃO.
 * O advogado confirma (vira humana, verde) ou descarta. Não há edição campo a campo: aqui ele
 * diz se aceita ou não a leitura, e a palavra final continua sendo dele.
 */
export function AnaliseBloco({ analise, acoes = true }: { analise: AnaliseItem; acoes?: boolean }) {
  const c = analise.conteudo ?? {};
  const resultado = seloResultado(c.resultado);
  const severidade = estiloSeveridade(c.severidade);
  const status = analise.status ?? "sugerida";

  return (
    <article
      className={`rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.02] sm:p-5 ${
        status === "descartada" ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${resultado.cls}`}
        >
          {resultado.txt}
        </span>
        {status === "sugerida" && (
          <span className="inline-block rounded-full border border-amber-brand/30 bg-amber-tint/50 px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-amber-brand">
            sugerido pela máquina
          </span>
        )}
        {status === "confirmada" && (
          <span className="inline-block rounded-full border border-moss-brand/30 bg-moss-tint px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-moss-brand">
            confirmada por você
          </span>
        )}
        {status === "descartada" && (
          <span className="inline-block rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
            descartada
          </span>
        )}
        {severidade && (
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${severidade.cls}`}
          >
            risco {severidade.txt}
          </span>
        )}
        {(analise.versao ?? 1) > 1 && (
          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
            v{analise.versao}
          </span>
        )}
      </div>

      <h4 className="mt-2 font-serif text-lg font-medium">{c.tipo_ato ?? "Análise"}</h4>

      {c.posicao_cliente && (
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente no polo: <span className="font-medium text-foreground">{c.posicao_cliente}</span>
        </p>
      )}

      {c.resumo && <p className="mt-3 text-sm text-muted-foreground">{c.resumo}</p>}

      {c.acao_necessaria && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-indigo-tint/60 px-3 py-2.5">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-brand" />
          <div>
            <div className="font-mono text-[0.6rem] uppercase tracking-wide text-indigo-brand">
              ação sugerida
            </div>
            <div className="text-sm">{c.acao_necessaria}</div>
          </div>
        </div>
      )}

      {c.prazo && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-tint/60 px-2.5 py-1 text-sm text-amber-brand">
          <Clock className="h-3.5 w-3.5" /> {c.prazo}
        </div>
      )}

      {Array.isArray(c.pontos) && c.pontos.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {c.pontos.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                style={{ background: "var(--ink-faint)" }}
              />
              {p}
            </li>
          ))}
        </ul>
      )}

      {c.trecho_fonte && (
        <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
          <span
            className="block font-mono text-[0.6rem] not-italic uppercase tracking-wide"
            style={{ color: "var(--ink-faint)" }}
          >
            trecho do documento
          </span>
          {c.trecho_fonte}
        </blockquote>
      )}

      {/* O que acontece se NÃO agir. É o que transforma a análise em decisão. */}
      {c.consequencia && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
              se não agir
            </div>
            <div className="text-sm">{c.consequencia}</div>
          </div>
        </div>
      )}

      {c.atencao && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg border-l-2 bg-amber-tint/30 px-3 py-2 text-sm text-muted-foreground ${
            severidade?.borda ?? "border-amber-brand"
          }`}
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-brand" />
          <span>{c.atencao}</span>
        </div>
      )}

      {acoes && status === "sugerida" && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
          <form action={confirmarAnaliseAction}>
            <input type="hidden" name="id" value={analise.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-moss-brand/30 bg-moss-tint px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-moss-brand transition-colors hover:border-moss-brand/60"
            >
              <Check className="h-3 w-3" /> confirmar leitura
            </button>
          </form>
          <form action={descartarAnaliseAction}>
            <input type="hidden" name="id" value={analise.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-3 w-3" /> descartar
            </button>
          </form>
        </div>
      )}

      <div
        className="mt-3 border-t border-border pt-2 font-mono text-[0.65rem]"
        style={{ color: "var(--ink-faint)" }}
      >
        {analise.modelo ?? "máquina"}
        {analise.editadoPor ? ` · ${status} por ${analise.editadoPor}` : " · você tem a palavra final"}
      </div>
    </article>
  );
}
