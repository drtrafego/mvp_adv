import Image from "next/image";
import { Scale, FileText, Clock, TriangleAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PrazosBoard } from "@/components/prazos-board";
import { ProcessosList } from "@/components/processos-list";
import { IntimacoesSemPrazo } from "@/components/intimacoes-sem-prazo";
import { Reveal } from "@/components/motion-primitives";
import { bancoConectado } from "@/db";
import { listarPrazos, listarProcessos, listarIntimacoesSemPrazo, resumo } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const conectado = bancoConectado();
  const [dados, prazos, processos, semPrazo] = await Promise.all([
    resumo(),
    listarPrazos(),
    listarProcessos(),
    listarIntimacoesSemPrazo(),
  ]);

  return (
    <div className="relative flex flex-1 flex-col">
      <SiteHeader resumo={dados} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {!conectado && <BancoDesconectado />}

        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <Reveal as="section">
            {dados.intimacoesSemPrazo > 0 && (
              <div className="mb-8">
                <IntimacoesSemPrazo
                  intimacoes={semPrazo}
                  total={dados.intimacoesSemPrazo}
                  compacto
                />
              </div>
            )}

            <SectionTitle icon={<Clock className="h-4 w-4" />} titulo="Prazos" subtitulo="o que precisa da sua palavra" />
            <PrazosBoard prazos={prazos} />
          </Reveal>

          <aside className="space-y-8">
            <Reveal as="section" delay={0.08}>
              <SectionTitle icon={<Scale className="h-4 w-4" />} titulo="Carteira" subtitulo="seus processos" />
              <ProcessosList processos={processos} />
            </Reveal>

            <Reveal as="section" delay={0.14} className="group overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] transition-shadow hover:shadow-md">
              <div className="relative h-40 w-full overflow-hidden">
                <Image
                  src="/images/justica.png"
                  alt="Justiça"
                  fill
                  sizes="400px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 font-serif text-base font-semibold">
                  <FileText className="h-4 w-4 text-amber-brand" /> Análise de documentos
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  No terminal, peça{" "}
                  <span className="font-mono text-foreground">&quot;analise a contestação do processo tal&quot;</span>{" "}
                  e a análise estruturada aparece aqui, editável campo a campo.
                </p>
              </div>
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
        <div className="font-serif text-lg font-semibold text-amber-brand">Banco (Neon) não conectado</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina <span className="font-mono">DATABASE_URL</span> no ambiente do painel (string do Neon) e
          rode as migrações. Sem isso, o painel mostra a interface, mas não há dados.
        </p>
      </div>
    </div>
  );
}

function RodapeFronteira() {
  return (
    <div className="mt-12 overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
      <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:block">
          <Image src="/images/mesa.png" alt="Mesa do advogado" fill sizes="112px" className="object-cover" />
        </div>
        <div>
          <div className="font-serif text-base font-semibold">A fronteira do sistema</div>
          <p className="mt-1 text-sm text-muted-foreground">
            O Gabinete coleta, organiza, analisa e sugere prazos. Ele não peticiona, não decide, não é
            consultoria. Leva você até a beira da decisão e para. Peticionar, traçar estratégia e
            assinar a peça é seu. A máquina propõe, o profissional dispõe.
          </p>
        </div>
      </div>
    </div>
  );
}
