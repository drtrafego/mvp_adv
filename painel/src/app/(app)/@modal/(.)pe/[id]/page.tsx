import { FileWarning } from "lucide-react";
import { detalhePeca } from "@/db/queries";
import { DetalheModal } from "@/components/detalhe-modal";
import { PecaDetalhe } from "@/components/peca/peca-detalhe";

export const dynamic = "force-dynamic";

export default async function PecaModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = await detalhePeca(id);

  return (
    <DetalheModal>
      {detalhe ? (
        <PecaDetalhe detalhe={detalhe} />
      ) : (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning className="h-6 w-6" />
          </span>
          <p className="mt-4 font-serif text-lg font-medium">Peça não encontrada</p>
        </div>
      )}
    </DetalheModal>
  );
}
