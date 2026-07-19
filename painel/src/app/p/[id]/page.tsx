import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { detalheProcesso } from "@/db/queries";
import { ProcessoDetalhe } from "@/components/processo/processo-detalhe";

export const dynamic = "force-dynamic";

export default async function ProcessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalhe = await detalheProcesso(id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> voltar ao painel
      </Link>

      {detalhe ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ProcessoDetalhe detalhe={detalhe} />
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning className="h-7 w-7" />
          </span>
          <p className="mt-4 font-serif text-xl font-medium">Processo não encontrado</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Este processo pode ter sido excluído, ou o banco (Neon) não está conectado neste
            ambiente.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao painel
          </Link>
        </div>
      )}
    </main>
  );
}
