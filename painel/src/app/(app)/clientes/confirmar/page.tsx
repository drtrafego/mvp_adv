import { UserCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FilaPartes } from "@/components/cliente/fila-partes";
import { partesAConfirmar } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function ConfirmarClientesPage() {
  const partes = await partesAConfirmar();
  const processos = new Set(partes.map((p) => p.processoId)).size;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="a máquina propõe, você dispõe"
        titulo="Confirmar clientes"
        icone={UserCheck}
        descricao={
          partes.length === 0
            ? "Nada esperando decisão: toda parte reconhecida já foi confirmada ou descartada."
            : `${partes.length} ${partes.length === 1 ? "parte reconhecida" : "partes reconhecidas"} em ${processos} ${processos === 1 ? "processo" : "processos"}. O nome vem dos destinatários da intimação; o teor fica ao lado para você conferir.`
        }
      />
      <FilaPartes partes={partes} />
    </div>
  );
}
