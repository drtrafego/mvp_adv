import { PageHeader } from "@/components/page-header";
import { PrazosBoard } from "@/components/prazos-board";
import { listarPrazos } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const prazos = await listarPrazos();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="o que precisa da sua palavra"
        titulo="Prazos"
        descricao="A máquina sugere; você confirma ou corrige. A data fatal é sempre calculada por código, nunca pela IA."
      />
      <PrazosBoard prazos={prazos} />
    </div>
  );
}
