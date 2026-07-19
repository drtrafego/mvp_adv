export function PageHeader({
  rotulo,
  titulo,
  descricao,
  acao,
}: {
  rotulo: string;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <div className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-indigo-brand">
          {rotulo}
        </div>
        <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
