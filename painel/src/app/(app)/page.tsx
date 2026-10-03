import Link from "next/link";
import { Scale, FileText, Clock, TriangleAlert, Wallet, ArrowUpRight, Workflow } from "lucide-react";
import { SaudeEscritorio } from "@/components/saude-escritorio";
import { SiteHeader } from "@/components/site-header";
import { PrazosBoard } from "@/components/prazos-board";
import { ProcessosList } from "@/components/processos-list";
import { IntimacoesSemPrazo } from "@/components/intimacoes-sem-prazo";
import { ChegouAgora } from "@/components/chegou-agora";
import { Reveal } from "@/components/motion-primitives";
import { bancoConectado } from "@/db";
import { intimacoesRecentes, listarPrazos, listarProcessos, resumo, saudeColeta } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const conectado = bancoConectado();
  const [dados, prazos, processos, recentes, coletas] = await Promise.all([
    resumo(),
    listarPrazos(),
    listarProcessos(),
    intimacoesRecentes(7),
    saudeColeta(),
  ]);

  return (
    <div className="relative flex flex-1 flex-col">
      <SiteHeader resumo={dados} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {!conectado && <BancoDesconectado />}

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <Atalho href="/inicial" icon={<FileText className="h-5 w-5" />} titulo="Preparar nova ação" detalhe="Organize o caso e solicite a minuta" />
          <Atalho href="/financeiro" icon={<Wallet className="h-5 w-5" />} titulo="Acompanhar honorários" detalhe="Vencimentos, pagamentos e cobranças" />
          <Atalho href="/operacao" icon={<Workflow className="h-5 w-5" />} titulo="Ver operação" detalhe="Coletas e rotinas do escritório" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <Reveal as="section">
            <SectionTitle icon={<Clock className="h-4 w-4" />} titulo="Prazos" subtitulo="o que precisa da sua palavra" />
            {dados.intimacoesSemPrazo > 0 && (
              <div className="mb-3">
                <IntimacoesSemPrazo total={dados.intimacoesSemPrazo} />
              </div>
            )}

            <PrazosBoard prazos={prazos} mostrarFiltros={false} />
            <Link href="/prazos" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-brand hover:underline">Abrir todos os prazos e filtros <ArrowUpRight className="h-4 w-4" /></Link>

            {recentes.length > 0 && (
              <div className="mt-8">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Chegou agora · últimos 7 dias
                  </h3>
                  <Link
                    href="/intimacoes"
                    className="font-mono text-[0.65rem] uppercase tracking-wide text-indigo-brand hover:underline"
                  >
                    ver todas
                  </Link>
                </div>
                <ChegouAgora intimacoes={recentes.slice(0, 6)} />
                {recentes.length > 6 && <Link href="/intimacoes" className="mt-3 inline-flex text-xs text-indigo-brand hover:underline">Continuar na lista de intimações</Link>}
              </div>
            )}

          </Reveal>

          <aside className="space-y-8">
            <Reveal as="section" delay={0.08}>
              <SectionTitle icon={<Scale className="h-4 w-4" />} titulo="Carteira" subtitulo="seus processos" />
              <ProcessosList processos={processos.slice(0, 5)} />
              {dados.totalProcessos > 5 && <Link href="/processos" className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-brand hover:underline">Ver toda a carteira <ArrowUpRight className="h-4 w-4" /></Link>}
            </Reveal>

            <Reveal as="section" delay={0.14}>
              <SaudeEscritorio coletas={coletas} conectado={conectado} />
            </Reveal>
          </aside>
        </div>

        <RodapeFronteira />
      </main>
    </div>
  );
}

function SectionTitle({ icon, titulo, subtitulo }: { icon: React.ReactNode; titulo: string; subtitulo: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-indigo-brand">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-indigo-tint text-indigo-brand">
          {icon}
        </span>
        {titulo}
      </div>
      <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{subtitulo}</h2>
      <div className="mt-3 h-px w-full bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

function BancoDesconectado() {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-brand/40 bg-amber-tint/60 p-5 shadow-sm shadow-amber-brand/5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-brand/15 text-amber-brand">
        <TriangleAlert className="h-5 w-5" />
      </span>
      <div>
        <div className="font-serif text-lg font-semibold text-amber-brand">O escritório ainda não está conectado</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhum dado real foi carregado. Conclua a configuração de acesso e do banco antes de cadastrar clientes ou acompanhar prazos.
        </p>
      </div>
    </div>
  );
}

function RodapeFronteira() {
  return (
    <div className="mt-12 overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
      <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <Scale className="h-8 w-8 shrink-0 text-indigo-brand" />
        <div>
          <div className="font-serif text-base font-semibold">Preparação assistida, decisão registrada</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira as análises, revise as minutas e confirme os prazos sugeridos. As decisões e as versões dos documentos ficam registradas no escritório.
          </p>
        </div>
      </div>
    </div>
  );
}

function Atalho({ href, icon, titulo, detalhe }: { href: string; icon: React.ReactNode; titulo: string; detalhe: string }) {
  return <Link href={href} className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-indigo-brand/40">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-tint text-indigo-brand">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{titulo}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{detalhe}</span></span>
    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-indigo-brand" />
  </Link>;
}
