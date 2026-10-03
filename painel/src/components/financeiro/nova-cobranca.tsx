"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import { criarCobrancaAction, type FinanceiroState } from "@/app/(app)/financeiro/actions";
import type { ClienteFinanceiro } from "@/db/financeiro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NovaCobranca({ clientes, hoje }: { clientes: ClienteFinanceiro[]; hoje: string }) {
  const [estado, acao, pendente] = useActionState(criarCobrancaAction, {} as FinanceiroState);
  return (
    <details className="group rounded-xl border bg-card shadow-sm" open={clientes.length === 0 ? true : undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Plus className="h-4 w-4 text-primary" /> Nova cobrança
        <span className="ml-auto text-xs font-normal text-muted-foreground">Honorários, parcela ou serviço</span>
      </summary>
      {clientes.length === 0 ? (
        <p className="border-t px-4 py-5 text-sm text-muted-foreground">
          Importe os clientes em <Link className="text-primary underline underline-offset-2" href="/configuracoes">Configurações</Link> para vincular os honorários à pessoa correta.
        </p>
      ) : (
        <form action={acao} className="border-t px-4 py-5">
          <fieldset disabled={pendente} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="financeiro-cliente" className="mb-1.5 block text-xs font-medium">Cliente</label>
              <select id="financeiro-cliente" name="cliente_id" required defaultValue="" className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="" disabled>Selecione o cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="financeiro-descricao" className="mb-1.5 block text-xs font-medium">Descrição</label>
              <Input id="financeiro-descricao" name="descricao" placeholder="Honorários — parcela 1/3" maxLength={200} required className="h-9" />
            </div>
            <div>
              <label htmlFor="financeiro-valor" className="mb-1.5 block text-xs font-medium">Valor em reais (R$)</label>
              <Input id="financeiro-valor" name="valor" placeholder="1.250,50" inputMode="decimal" maxLength={24} required className="h-9" />
            </div>
            <div>
              <label htmlFor="financeiro-vencimento" className="mb-1.5 block text-xs font-medium">Vencimento</label>
              <Input id="financeiro-vencimento" name="vencimento" type="date" min="1900-01-01" max="9999-12-31" defaultValue={hoje} required className="h-9" />
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${estado.erro ? "text-destructive" : "text-moss-brand dark:text-emerald-300"}`} aria-live="polite">
              {estado.erro ?? estado.mensagem ?? "O registro fica pendente até você confirmar o recebimento."}
            </p>
            <Button type="submit" disabled={pendente} size="lg">
              {pendente ? <Loader2 className="animate-spin" /> : <Plus />} {pendente ? "Salvando…" : "Cadastrar cobrança"}
            </Button>
          </div>
        </form>
      )}
    </details>
  );
}
