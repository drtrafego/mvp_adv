import { FileWarning } from "lucide-react";
import { detalheProcesso } from "@/db/queries";
import { ProcessoModal } from "@/components/processo/processo-modal";
import { ProcessoDetalhe } from "@/components/processo/processo-detalhe";

export const dynamic = "force-dynamic";

export default async function ProcessoModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalhe = await detalheProcesso(id);

  return (
    <ProcessoModal>
      {detalhe ? (
        <ProcessoDetalhe detalhe={detalhe} />
      ) : (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning className="h-6 w-6" />
          </span>
          <p className="mt-4 font-serif text-lg font-medium">Processo não encontrado</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Ele pode ter sido excluído, ou o banco não está conectado.
          </p>
        </div>
      )}
    </ProcessoModal>
  );
}
