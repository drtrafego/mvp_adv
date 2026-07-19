import Link from "next/link";
import { FileSearch, TriangleAlert, ArrowRight, Clock } from "lucide-react";
import type { AnaliseRow } from "@/db/queries";

function selo(resultado?: string) {
  const r = (resultado ?? "").toLowerCase();
  if (r.includes("favor") && !r.includes("des")) return { txt: "favorável", cls: "bg-moss-tint text-moss-brand" };
  if (r.includes("desfavor")) return { txt: "desfavorável", cls: "bg-amber-tint text-amber-brand" };
  return { txt: "neutro", cls: "bg-muted text-muted-foreground" };
}

export function AnalisesList({ analises }: { analises: AnaliseRow[] }) {
  if (analises.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FileSearch className="h-7 w-7" />
        </span>
        <p className="mt-4 font-serif text-base font-medium">Nenhuma análise ainda</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          No terminal:{" "}
          <span className="font-mono text-foreground">&quot;analisa a intimação do processo tal&quot;</span>. A
          análise aparece aqui, sempre como sugestão para você revisar.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {analises.map((a) => {
        const c = a.conteudo ?? {};
        const s = selo(c.resultado);
        return (
          <article key={a.id} className="rounded-xl border bg-card p-5 shadow-sm shadow-black/[0.02]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${s.cls}`}>
                    {s.txt}
                  </span>
                  <span className="inline-block rounded-full border border-amber-brand/30 bg-amber-tint/50 px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-amber-brand">
                    sugerido pela máquina
                  </span>
                </div>
                <h3 className="mt-2 font-serif text-lg font-medium">{c.tipo_ato ?? "Análise"}</h3>
                {a.numeroCnj && (
                  <Link href={`/p/${a.processoId}`} className="mt-0.5 inline-block font-mono text-xs text-indigo-brand hover:underline">
                    {a.numeroCnj}{a.clienteNome ? ` · ${a.clienteNome}` : ""}
                  </Link>
                )}
              </div>
            </div>

            {c.resumo && <p className="mt-3 text-sm text-muted-foreground">{c.resumo}</p>}

            {c.acao_necessaria && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-indigo-tint/60 px-3 py-2.5">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-brand" />
                <div>
                  <div className="font-mono text-[0.6rem] uppercase tracking-wide text-indigo-brand">ação sugerida</div>
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
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" style={{ background: "var(--ink-faint)" }} />
                    {p}
                  </li>
                ))}
              </ul>
            )}

            {c.atencao && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-amber-brand bg-amber-tint/30 px-3 py-2 text-sm text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-brand" />
                <span>{c.atencao}</span>
              </div>
            )}

            <div className="mt-3 border-t border-border pt-2 font-mono text-[0.65rem] text-ink-faint" style={{ color: "var(--ink-faint)" }}>
              {a.modelo ?? "máquina"} · você tem a palavra final
            </div>
          </article>
        );
      })}
    </div>
  );
}
