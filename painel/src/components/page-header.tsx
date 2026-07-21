import type { LucideIcon } from "lucide-react";

/**
 * Banner de topo das páginas internas: fundo índigo da marca, textura de pontos
 * sutil, ícone temático como marca-d'água. Sóbrio (advocacia), sem foto. O `icone`
 * é opcional; sem ele, o banner continua funcionando só com o texto.
 */
export function PageHeader({
  rotulo,
  titulo,
  descricao,
  acao,
  icone: Icone,
}: {
  rotulo: string;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  icone?: LucideIcon;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-indigo-brand/30 bg-indigo-brand text-white shadow-sm shadow-black/10">
      {/* textura de pontos */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />
      {/* brilho suave para profundidade */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 12% -10%, rgba(255,255,255,0.14), transparent 55%), linear-gradient(to bottom right, transparent 40%, rgba(0,0,0,0.28))",
        }}
        aria-hidden
      />
      {/* ícone temático como marca-d'água */}
      {Icone && (
        <Icone
          className="pointer-events-none absolute -right-5 -top-6 h-40 w-40 text-white/[0.07]"
          strokeWidth={1}
          aria-hidden
        />
      )}
      {/* faixa âmbar fina na base */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-amber-brand/70 via-amber-brand/20 to-transparent" aria-hidden />

      <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 py-7 sm:px-8">
        <div>
          <div className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-amber-200/90">
            {rotulo}
          </div>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight text-white">
            {titulo}
          </h1>
          {descricao && <p className="mt-1.5 max-w-xl text-sm text-white/75">{descricao}</p>}
        </div>
        {acao}
      </div>
    </div>
  );
}
