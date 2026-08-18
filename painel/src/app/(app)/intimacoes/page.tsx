import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IntimacoesList } from "@/components/intimacoes-list";
import { listarIntimacoes } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function IntimacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;
  const soSemPrazo = filtro === "sem-prazo";

  const todas = await listarIntimacoes();
  const semPrazo = todas.filter((i) => !i.temPrazo && i.processada !== true);
  const intimacoes = soSemPrazo ? semPrazo : todas;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="a fonte oficial dos prazos"
        titulo="Intimações"
        icone={Inbox}
        descricao="Comunicações do DJEN pela sua OAB, com inteiro teor. É daqui que nascem os prazos."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Aba href="/intimacoes" ativa={!soSemPrazo} rotulo={`todas (${todas.length})`} />
        <Aba
          href="/intimacoes?filtro=sem-prazo"
          ativa={soSemPrazo}
          rotulo={`sem prazo (${semPrazo.length})`}
        />
      </div>

      <IntimacoesList intimacoes={intimacoes} />
    </div>
  );
}

function Aba({ href, ativa, rotulo }: { href: string; ativa: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
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
