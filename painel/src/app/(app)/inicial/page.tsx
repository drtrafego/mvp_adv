import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InicialForm } from "@/components/inicial-form";

export const dynamic = "force-dynamic";

export default function InicialPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="caso novo"
        titulo="Inicial"
        icone={FilePlus2}
        descricao="Comece um caso do zero. Descreva os fatos; o squad monta a tese (construtor-tese), verifica os fundamentos (pesquisador) e redige o rascunho da petição inicial (redator), sob a trava de citações."
      />
      <InicialForm />
      <div className="mt-6 rounded-xl border border-amber-brand/30 bg-amber-tint/40 p-5 text-sm text-muted-foreground">
        <p>
          Depois de montar, o rascunho aparece na aba <strong className="text-foreground">Peças</strong>.
          Você revisa, edita e assina. Quando protocolar no tribunal (isso é seu), informe o número
          CNJ na peça e o caso entra na carteira de <strong className="text-foreground">Processos</strong>{" "}
          e na coleta diária.
        </p>
      </div>
    </div>
  );
}
