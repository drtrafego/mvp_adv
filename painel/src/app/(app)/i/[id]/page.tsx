import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { detalheIntimacao } from "@/db/queries";
import { IntimacaoDetalhe } from "@/components/intimacao/intimacao-detalhe";
import { exigirLogin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntimacaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirLogin();
  const { id } = await params;
  const detalhe = await detalheIntimacao(id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/intimacoes"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> voltar às intimações
      </Link>

      {detalhe ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <IntimacaoDetalhe detalhe={detalhe} />
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning className="h-7 w-7" />
          </span>
          <p className="mt-4 font-serif text-xl font-medium">Intimação não encontrada</p>
        </div>
      )}
    </main>
  );
}
