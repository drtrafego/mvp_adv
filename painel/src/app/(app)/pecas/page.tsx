import { FileSignature } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PecasList } from "@/components/pecas-list";
import { listarPecas } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function PecasPage() {
  const pecas = await listarPecas();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="rascunhos"
        titulo="Peças"
        icone={FileSignature}
        descricao={`${pecas.length} ${pecas.length === 1 ? "peça" : "peças"}. Rascunhos gerados pelo squad forense: nascem como sugestão (máquina), você revisa, edita e assina.`}
      />
      <PecasList pecas={pecas} />
    </div>
  );
}
