import { FileWarning } from "lucide-react";
import { detalheCliente } from "@/db/queries";
import { DetalheModal } from "@/components/detalhe-modal";
import { ClienteDetalhe } from "@/components/cliente/cliente-detalhe";

export const dynamic = "force-dynamic";

export default async function ClienteModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = await detalheCliente(id);

  return (
    <DetalheModal>
      {detalhe ? (
        <ClienteDetalhe detalhe={detalhe} />
      ) : (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning className="h-6 w-6" />
          </span>
          <p className="mt-4 font-serif text-lg font-medium">Cliente não encontrado</p>
        </div>
      )}
    </DetalheModal>
  );
}
