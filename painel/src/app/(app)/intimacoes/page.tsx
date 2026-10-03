import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IntimacoesList } from "@/components/intimacoes-list";
import { contarIntimacoes, listarIntimacoes, type FiltroIntimacao } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function IntimacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const filtro: FiltroIntimacao = params.filtro === "sem-prazo" || params.filtro === "sem-analise" || params.filtro === "cuidadas" ? params.filtro : "todas";
  const contagens = await contarIntimacoes();
  const total = contagens[filtro];
  const ultimaPagina = Math.max(1, Math.ceil(total / 100));
  const solicitada = Number(params.pagina ?? "1");
  const pagina = Math.min(ultimaPagina, Number.isFinite(solicitada) ? Math.max(1, Math.trunc(solicitada)) : 1);
  const intimacoes = await listarIntimacoes({ filtro, pagina });
  const hrefPagina = (n: number) => `/intimacoes?filtro=${filtro}&pagina=${n}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="a fonte oficial dos prazos"
        titulo="Intimações"
        icone={Inbox}
        descricao="Comunicações do DJEN pela sua OAB, com inteiro teor. É daqui que nascem os prazos."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Aba href="/intimacoes" ativa={filtro === "todas"} rotulo={`todas (${contagens.todas})`} />
        <Aba
          href="/intimacoes?filtro=sem-prazo"
          ativa={filtro === "sem-prazo"}
          rotulo={`sem prazo (${contagens["sem-prazo"]})`}
        />
        <Aba href="/intimacoes?filtro=sem-analise" ativa={filtro === "sem-analise"} rotulo={`sem análise (${contagens["sem-analise"]})`} />
        <Aba href="/intimacoes?filtro=cuidadas" ativa={filtro === "cuidadas"} rotulo={`cuidadas (${contagens.cuidadas})`} />
      </div>

      {total > 100 && <p className="mb-3 text-xs text-muted-foreground">Exibindo {(pagina - 1) * 100 + 1}–{Math.min(pagina * 100, total)} de {total} intimações.</p>}
      <IntimacoesList intimacoes={intimacoes} />
      {ultimaPagina > 1 && <nav aria-label="Páginas de intimações" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        {pagina > 1 ? <Link href={hrefPagina(pagina - 1)} className="rounded-lg border bg-card px-4 py-2 hover:bg-muted">Anterior</Link> : <span />}
        <span className="text-muted-foreground">Página {pagina} de {ultimaPagina}</span>
        {pagina < ultimaPagina ? <Link href={hrefPagina(pagina + 1)} className="rounded-lg border bg-card px-4 py-2 hover:bg-muted">Próxima</Link> : <span />}
      </nav>}
    </div>
  );
}

function Aba({ href, ativa, rotulo }: { href: string; ativa: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={`rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
        ativa
          ? "border-indigo-brand/40 bg-indigo-tint text-indigo-brand"
          : "bg-card text-muted-foreground hover:border-indigo-brand/30"
      }`}
    >
      {rotulo}
    </Link>
  );
}
