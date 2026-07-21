import { FileSearch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AnalisesList } from "@/components/analises-list";
import { listarAnalises } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function AnalisesPage() {
  const analises = await listarAnalises();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="a máquina lê, você decide"
        titulo="Análises"
        icone={FileSearch}
        descricao="Leitura assistida de intimações e documentos: resumo, resultado, ação sugerida e prazo. Toda análise é sugestão, sempre com a sua palavra final."
      />
      <AnalisesList analises={analises} />
    </div>
  );
}
