import { WalletCards } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FinanceiroPainel } from "@/components/financeiro/financeiro-painel";
import { carregarFinanceiro } from "@/db/financeiro";
import { exigirLogin } from "@/lib/auth";
import { hojeFinanceiro } from "@/lib/financeiro";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  await exigirLogin();
  const hoje = hojeFinanceiro();
  const dados = await carregarFinanceiro(hoje);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader rotulo="rotina do escritório" titulo="Honorários e cobranças" icone={WalletCards}
        descricao="Acompanhe vencimentos, registre recebimentos e prepare lembretes para seus clientes." />
      <FinanceiroPainel dados={dados} hoje={hoje} />
    </div>
  );
}
