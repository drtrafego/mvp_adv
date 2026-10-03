import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import type { SaudeColeta } from "@/db/queries";

export function SaudeEscritorio({ coletas, conectado }: { coletas: SaudeColeta[]; conectado: boolean }) {
  return <section className="rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex items-center gap-2 font-serif text-lg font-semibold"><Activity className="h-5 w-5 text-indigo-brand" /> Saúde das coletas</div>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Confira quando cada fonte foi consultada. Uma coleta antiga exige atenção.</p>
    {!conectado ? <p className="mt-4 text-sm text-amber-brand">Banco não configurado.</p> : <div className="mt-4 space-y-3">{coletas.map((c) => {
      const recente = c.horasAtras !== null && c.horasAtras <= 26;
      const ok = c.status === "ok" && recente;
      const label = !c.status ? "Sem registro" : c.status === "erro" ? "Falhou" : c.status === "parcial" ? "Incompleta" : !recente ? "Desatualizada" : "Última coleta OK";
      return <div key={c.fonte} className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs uppercase">{c.fonte === "djen" ? "Intimações · DJEN" : "Processos · DataJud"}</span><span className={`rounded-full px-2 py-1 text-[0.65rem] font-medium ${ok ? "bg-moss-tint text-moss-brand" : "bg-amber-tint text-amber-brand"}`}>{label}</span></div>
        <p className="mt-2 text-xs text-muted-foreground">{c.quando ? new Date(c.quando).toLocaleString("pt-BR", { timeZone: "America/Cuiaba", dateStyle: "short", timeStyle: "short" }) + " · horário de Cuiabá" : "Nenhuma execução registrada."}</p>
        {c.novos !== null && <p className="mt-1 text-xs text-muted-foreground">{c.itens ?? 0} encontrados · {c.novos} novos</p>}
      </div>;
    })}</div>}
    <Link href="/operacao" className="mt-4 inline-flex items-center gap-1 text-xs text-indigo-brand hover:underline">Ver operação <ArrowUpRight className="h-3 w-3" /></Link>
  </section>;
}
