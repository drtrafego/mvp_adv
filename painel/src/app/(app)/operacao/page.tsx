import Link from "next/link";
import { Workflow, Clock, FileSignature, Wallet, Users, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SaudeEscritorio } from "@/components/saude-escritorio";
import { saudeColeta } from "@/db/queries";
import { bancoConectado } from "@/db";

export const dynamic = "force-dynamic";

const modulos = [
  { nome: "Prazos", descricao: "Revise sugestões, confira vencimentos e registre sua revisão.", href: "/prazos", icon: Clock },
  { nome: "Peças", descricao: "Acompanhe a preparação, a revisão e as versões das minutas.", href: "/pecas", icon: FileSignature },
  { nome: "Financeiro", descricao: "Organize honorários, vencimentos, recebimentos e cobranças.", href: "/financeiro", icon: Wallet },
  { nome: "Clientes", descricao: "Consulte contatos e mantenha os cadastros do escritório.", href: "/clientes", icon: Users },
];

export default async function OperacaoPage() {
  const coletas = await saudeColeta();
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <PageHeader rotulo="controle do escritório" titulo="Operação" icone={Workflow} descricao="Acompanhe as coletas e acesse as rotinas do escritório." />
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold">Rotinas do escritório</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Mantenha os processos, documentos e recebimentos organizados em um só lugar.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{modulos.map(({nome, descricao, href, icon: Icon}) => <Link key={nome} href={href} className="group rounded-xl border bg-background/50 p-4 transition-colors hover:border-indigo-brand/40">
            <div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-indigo-brand" /><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-brand" /></div><h3 className="text-sm font-semibold">{nome}</h3><p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          </Link>)}</div>
        </section>
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold">Pendências para acompanhar</h2>
          <div className="mt-4 divide-y">
            <div className="py-3"><h3 className="text-sm font-semibold">Revisão de intimações</h3><p className="mt-1 text-sm text-muted-foreground">Confira as novas comunicações e as sugestões de prazo antes de confirmar o acompanhamento.</p><Link className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-brand hover:underline" href="/intimacoes?filtro=sem-analise">Ver intimações sem análise <ArrowUpRight className="h-4 w-4" /></Link></div>
            <div className="py-3"><h3 className="text-sm font-semibold">Vencimentos e cobranças</h3><p className="mt-1 text-sm text-muted-foreground">Confira os honorários em aberto, prepare a mensagem e registre os pagamentos recebidos.</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4"><Link className="inline-flex items-center gap-1 text-sm text-indigo-brand hover:underline" href="/pecas">Ver peças <ArrowUpRight className="h-4 w-4" /></Link><Link className="inline-flex items-center gap-1 text-sm text-indigo-brand hover:underline" href="/financeiro">Ver cobranças <ArrowUpRight className="h-4 w-4" /></Link></div>
        </section>
      </div>
      <SaudeEscritorio coletas={coletas} conectado={bancoConectado()} />
    </div>
  </main>;
}
