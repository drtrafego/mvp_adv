import Link from "next/link";
import { Users, UserCheck, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ClientesList } from "@/components/clientes-list";
import { listarClientes, resumo } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [clientes, dados] = await Promise.all([listarClientes(), resumo()]);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="quem você representa"
        titulo="Clientes"
        icone={Users}
        descricao={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"} na carteira, agregados a partir dos processos.`}
      />

      {dados.partesAConfirmar > 0 && (
        <Link
          href="/clientes/confirmar"
          className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-brand/40 bg-amber-tint/50 px-4 py-3 transition-colors hover:bg-amber-tint"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-brand/15 text-amber-brand">
            <UserCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-sm font-semibold text-amber-brand">
              {dados.partesAConfirmar}{" "}
              {dados.partesAConfirmar === 1 ? "parte reconhecida" : "partes reconhecidas"} esperando
              sua palavra
            </div>
            <p className="text-xs text-muted-foreground">
              {dados.clientesSugeridos > 0
                ? `${dados.clientesSugeridos} vínculo(s) já gravado(s) como sugestão (amarelo). Onde os dois polos foram intimados, nada virou cliente sozinho.`
                : "Onde os dois polos foram intimados, nada vira cliente sozinho: quem decide é você."}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-brand" />
        </Link>
      )}

      <ClientesList clientes={clientes} />
    </div>
  );
}
