import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PrazosBoard } from "@/components/prazos-board";
import { IntimacoesSemPrazo } from "@/components/intimacoes-sem-prazo";
import { listarPrazos, resumo } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const [prazos, dados] = await Promise.all([listarPrazos(), resumo()]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="o que precisa da sua palavra"
        titulo="Prazos"
        icone={CalendarClock}
        descricao="A máquina sugere; você confirma ou corrige. A data fatal é sempre calculada por código, nunca pela IA."
      />

      {dados.intimacoesSemPrazo > 0 && (
        <div className="mb-4">
          <IntimacoesSemPrazo total={dados.intimacoesSemPrazo} />
        </div>
      )}

      <PrazosBoard prazos={prazos} />
    </div>
  );
}
