import { FileWarning } from "lucide-react";
import { detalheIntimacao } from "@/db/queries";
import { DetalheModal } from "@/components/detalhe-modal";
import { IntimacaoDetalhe } from "@/components/intimacao/intimacao-detalhe";

export const dynamic = "force-dynamic";

export default async function IntimacaoModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = await detalheIntimacao(id);

  return (
    <DetalheModal>
      {detalhe ? (
        <IntimacaoDetalhe detalhe={detalhe} />
      ) : (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning className="h-6 w-6" />
          </span>
          <p className="mt-4 font-serif text-lg font-medium">Intimação não encontrada</p>
        </div>
      )}
    </DetalheModal>
  );
}
