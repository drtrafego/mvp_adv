import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IntimacoesList } from "@/components/intimacoes-list";
import { listarIntimacoes } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function IntimacoesPage() {
  const intimacoes = await listarIntimacoes();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="a fonte oficial dos prazos"
        titulo="Intimações"
        icone={Inbox}
        descricao="Comunicações do DJEN pela sua OAB, com inteiro teor. É daqui que nascem os prazos."
      />
      <IntimacoesList intimacoes={intimacoes} />
    </div>
  );
}
