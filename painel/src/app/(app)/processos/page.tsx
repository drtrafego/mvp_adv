import { PageHeader } from "@/components/page-header";
import { ProcessosList } from "@/components/processos-list";
import { listarProcessos } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function ProcessosPage() {
  const processos = await listarProcessos();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="sua carteira"
        titulo="Processos"
        descricao={`${processos.length} ${processos.length === 1 ? "processo" : "processos"} na carteira. Clique para ver prazos, movimentações, documentos e anotações.`}
      />
      <ProcessosList processos={processos} />
    </div>
  );
}
