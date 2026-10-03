"use client";

import { useState } from "react";
import { AlertCircle, MessageSquare, CircleDollarSign, Clock3, Receipt, Search, WalletCards } from "lucide-react";
import type { DadosFinanceiros } from "@/db/financeiro";
import { Input } from "@/components/ui/input";
import { NovaCobranca } from "./nova-cobranca";
import { CobrancaCard } from "./cobranca-card";
import { cobrancaNoFiltro, formatarValor, type FiltroCobranca } from "@/lib/financeiro";

const filtros: { chave: FiltroCobranca; nome: string }[] = [
  { chave: "pendentes", nome: "Pendentes" }, { chave: "atrasadas", nome: "Em atraso" },
  { chave: "a_vencer", nome: "A vencer" }, { chave: "pagas", nome: "Recebidos" },
  { chave: "canceladas", nome: "Cancelados" }, { chave: "todas", nome: "Todos" },
];

export function FinanceiroPainel({ dados, hoje }: { dados: DadosFinanceiros; hoje: string }) {
  const [filtro, setFiltro] = useState<FiltroCobranca>("pendentes");
  const [busca, setBusca] = useState("");
  if (dados.indisponivel) {
    const mensagem = dados.indisponivel === "sem_banco" ? "Conecte o banco do escritório para cadastrar e acompanhar cobranças."
      : dados.indisponivel === "migracao" ? "O financeiro aguarda a atualização do banco. Peça ao administrador para aplicar a migração 0005_financeiro.sql."
      : "Não foi possível consultar o financeiro. Verifique a conexão do banco e recarregue a página.";
    return <div className="flex items-start gap-3 rounded-xl border bg-card p-5"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-brand" /><div><h2 className="font-medium">Financeiro indisponível</h2><p className="mt-1 text-sm text-muted-foreground">{mensagem}</p></div></div>;
  }
  const pesquisa = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = dados.cobrancas.filter((c) => cobrancaNoFiltro(c, filtro, hoje) && (!pesquisa || `${c.clienteNome} ${c.descricao}`.toLocaleLowerCase("pt-BR").includes(pesquisa)));
  const indicadores = [
    { nome: "Honorários em aberto", valor: formatarValor(dados.resumo.emAberto), icone: WalletCards, tom: "text-primary bg-indigo-tint" },
    { nome: "Em atraso", valor: formatarValor(dados.resumo.emAtraso), icone: Clock3, tom: "text-destructive bg-destructive/10" },
    { nome: "Recebido no histórico", valor: formatarValor(dados.resumo.recebido), icone: CircleDollarSign, tom: "text-moss-brand bg-moss-tint dark:text-emerald-300" },
    { nome: "Cobranças pendentes", valor: String(dados.resumo.totalPendentes), icone: Receipt, tom: "text-amber-brand bg-amber-tint dark:text-amber-200" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map(({ nome, valor, icone: Icone, tom }) => <div key={nome} className="rounded-xl border bg-card p-4 shadow-sm"><span className={`mb-3 inline-flex rounded-lg p-2 ${tom}`}><Icone className="h-4 w-4" /></span><div className="font-serif text-2xl font-semibold tabular-nums">{valor}</div><div className="mt-1 text-xs text-muted-foreground">{nome}</div></div>)}
      </div>
      <NovaCobranca clientes={dados.clientes} hoje={hoje} />
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-indigo-tint/40 px-4 py-3">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground"><strong className="font-medium text-foreground">Mensagem de cobrança.</strong> Prepare o texto e confira o destinatário antes de enviar. Registre o recebimento para manter os valores em aberto atualizados.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar cobranças">
          {filtros.map((f) => <button type="button" key={f.chave} aria-pressed={filtro === f.chave} onClick={() => setFiltro(f.chave)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filtro === f.chave ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>{f.nome}</button>)}
        </div>
        <div className="relative w-full sm:max-w-64"><label className="sr-only" htmlFor="financeiro-busca">Buscar cliente ou descrição</label><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input id="financeiro-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente ou descrição" className="h-9 pl-8" /></div>
      </div>
      {dados.listaLimitada && <p className="text-xs text-amber-brand">Os totais incluem todo o histórico. A lista exibe até 500 registros, priorizando pendentes e primeiros vencimentos; os filtros se aplicam a esta lista.</p>}
      <p className="text-xs text-muted-foreground" aria-live="polite">{visiveis.length} {visiveis.length === 1 ? "cobrança nesta visão" : "cobranças nesta visão"} · Valores em reais</p>
      {visiveis.length ? <div className="space-y-3">{visiveis.map((c) => <CobrancaCard key={c.id} cobranca={c} hoje={hoje} />)}</div> : <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center"><Receipt className="h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-serif text-lg font-medium">{dados.cobrancas.length === 0 ? "Organize seus primeiros honorários" : "Nenhuma cobrança nesta visão"}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{dados.cobrancas.length === 0 ? "Cadastre o cliente, o valor e o vencimento. A rotina de recebimentos começa com esses três dados." : "Escolha outro filtro ou ajuste a busca para encontrar o registro."}</p></div>}
    </div>
  );
}
