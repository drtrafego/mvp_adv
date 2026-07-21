import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ClientesList } from "@/components/clientes-list";
import { listarClientes } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await listarClientes();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="quem você representa"
        titulo="Clientes"
        icone={Users}
        descricao={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"} na carteira, agregados a partir dos processos.`}
      />
      <ClientesList clientes={clientes} />
    </div>
  );
}
