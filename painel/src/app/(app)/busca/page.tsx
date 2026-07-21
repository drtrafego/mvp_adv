import Link from "next/link";
import { Scale, Users, CalendarClock, SearchX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buscaGlobal } from "@/db/queries";
import { formatarData } from "@/lib/prazo-ui";

export const dynamic = "force-dynamic";

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const termo = q.trim();
  const res = termo
    ? await buscaGlobal(termo)
    : { processos: [], clientes: [], prazos: [] };
  const total = res.processos.length + res.clientes.length + res.prazos.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="busca"
        titulo={termo ? `Resultados para "${termo}"` : "Busca"}
        descricao={
          termo
            ? `${total} ${total === 1 ? "resultado" : "resultados"} em processos, clientes e prazos.`
            : "Use o campo de busca na barra lateral para achar processos, clientes e prazos."
        }
      />

      {termo && total === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <SearchX className="h-7 w-7" />
          </span>
          <p className="mt-4 font-serif text-base font-medium">Nada encontrado</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Tente parte do número do processo, o nome do cliente ou o tipo de ato do prazo.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {res.processos.length > 0 && (
          <Secao titulo="Processos" icone={<Scale className="h-4 w-4" />}>
            {res.processos.map((p) => (
              <Link key={p.id} href={`/p/${p.id}`} className={itemClass}>
                <span className="truncate font-mono text-sm">{p.numeroCnj}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {p.clienteNome ?? "sem cliente"}
                </span>
              </Link>
            ))}
          </Secao>
        )}

        {res.clientes.length > 0 && (
          <Secao titulo="Clientes" icone={<Users className="h-4 w-4" />}>
            {res.clientes.map((c) => (
              <Link key={c.id} href={`/c/${c.id}`} className={itemClass}>
                <span className="truncate font-serif text-sm">{c.nome}</span>
              </Link>
            ))}
          </Secao>
        )}

        {res.prazos.length > 0 && (
          <Secao titulo="Prazos" icone={<CalendarClock className="h-4 w-4" />}>
            {res.prazos.map((p) => (
              <Link key={p.id} href={`/pz/${p.id}`} className={itemClass}>
                <span className="truncate text-sm">{p.ato}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatarData(p.dataFatal)}
                </span>
              </Link>
            ))}
          </Secao>
        )}
      </div>
    </div>
  );
}

const itemClass =
  "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50";

function Secao({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
        {icone}
        {titulo}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
