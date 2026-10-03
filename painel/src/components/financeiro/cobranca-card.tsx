"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle, X, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelarCobrancaAction, registrarPagamentoAction, type FinanceiroState } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarDataFinanceira, formatarValor, linkWhatsapp, textoCobranca, type CobrancaLinha } from "@/lib/financeiro";

export function CobrancaCard({ cobranca: c, hoje }: { cobranca: CobrancaLinha; hoje: string }) {
  const [acao, setAcao] = useState<"pagar" | "cancelar" | null>(null);
  const [pagoEm, setPagoEm] = useState(hoje);
  const [pendente, iniciar] = useTransition();
  const emAtraso = c.status === "pendente" && c.vencimento < hoje;
  const texto = textoCobranca(c, hoje);
  const whatsapp = linkWhatsapp(c.clienteTelefone, texto);
  const rotulo = c.status === "pago" ? "Recebido" : c.status === "cancelado" ? "Cancelado" : emAtraso ? "Em atraso" : c.vencimento === hoje ? "Vence hoje" : "A vencer";
  const tom = c.status === "pago" ? "bg-moss-tint text-moss-brand dark:text-emerald-300" : c.status === "cancelado" ? "bg-muted text-muted-foreground" : emAtraso ? "bg-destructive/10 text-destructive" : "bg-amber-tint text-amber-brand dark:text-amber-200";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Lembrete copiado. Revise antes de enviar ao cliente.");
    } catch {
      toast.error("Selecione o texto abaixo e copie manualmente.");
    }
  }

  function confirmar() {
    iniciar(async () => {
      try {
        const resultado: FinanceiroState = acao === "pagar" ? await registrarPagamentoAction(c.id, pagoEm) : await cancelarCobrancaAction(c.id);
        if (resultado.ok) {
          toast.success(resultado.mensagem);
          setAcao(null);
        } else toast.error(resultado.erro ?? "Não foi possível atualizar a cobrança.");
      } catch {
        toast.error("Não foi possível atualizar. Verifique sua sessão e tente novamente.");
      }
    });
  }

  return (
    <article className={`overflow-hidden rounded-xl border bg-card shadow-sm [content-visibility:auto] [contain-intrinsic-size:200px] ${emAtraso ? "border-destructive/25" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/c/${c.clienteId}`} className="font-serif text-base font-semibold hover:text-primary hover:underline">{c.clienteNome}</Link>
            <span className={`rounded-full px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide ${tom}`}>{rotulo}</span>
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{c.descricao}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Vencimento: {formatarDataFinanceira(c.vencimento)}
            {c.pagoEm && <span className="ml-2 text-moss-brand dark:text-emerald-300">Recebido em {formatarDataFinanceira(c.pagoEm)}</span>}
          </p>
        </div>
        <div className="font-serif text-xl font-semibold tabular-nums">{formatarValor(c.valorCentavos)}</div>
      </div>
      {c.status === "pendente" && (
        <div className="border-t bg-muted/20 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAcao("pagar")} disabled={pendente}><Check /> Registrar recebimento</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAcao("cancelar")} disabled={pendente}><X /> Cancelar cobrança</Button>
          </div>
          {acao && (
            <div className="mt-3 rounded-lg border bg-card p-3">
              {acao === "pagar" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor={`pagamento-${c.id}`} className="text-sm">Data do recebimento</label>
                  <Input id={`pagamento-${c.id}`} type="date" min="1900-01-01" max={hoje} value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} className="max-w-44" disabled={pendente} />
                  <span className="text-xs text-muted-foreground">Confirme somente após conferir o pagamento.</span>
                </div>
              ) : <p className="text-sm">Cancelar esta cobrança de {formatarValor(c.valorCentavos)}? Ela permanece no histórico.</p>}
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" variant={acao === "cancelar" ? "destructive" : "default"} disabled={pendente || (acao === "pagar" && !pagoEm)} onClick={confirmar}>
                  {pendente && <Loader2 className="animate-spin" />} {acao === "pagar" ? "Confirmar recebimento" : "Confirmar cancelamento"}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={() => setAcao(null)}>Voltar</Button>
              </div>
            </div>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Preparar lembrete de pagamento</summary>
            <label className="sr-only" htmlFor={`lembrete-${c.id}`}>Texto do lembrete para {c.clienteNome}</label>
            <textarea id={`lembrete-${c.id}`} value={texto} readOnly rows={7} className="mt-3 w-full resize-y rounded-lg border bg-card p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={copiar}><Copy /> Copiar texto</Button>
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8rem] font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp</a>
              ) : <p className="text-xs text-muted-foreground">Cadastre um telefone válido no cliente para abrir o WhatsApp.</p>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">O texto é um rascunho. Abrir o WhatsApp não envia nem registra o envio.</p>
          </details>
        </div>
      )}
    </article>
  );
}
