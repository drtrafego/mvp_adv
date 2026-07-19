import Image from "next/image";
import { StatGrid } from "@/components/stat-grid";

/** Hero do painel com o banner de advocacia (tira a cara de IA) e o resumo em números. */
export function SiteHeader({
  resumo,
}: {
  resumo: { totalProcessos: number; prazosAbertos: number; sugeridos: number; venceEm7Dias: number };
}) {
  return (
    <header className="relative isolate overflow-hidden border-b">
      <Image
        src="/images/banner.png"
        alt="Escritório de advocacia"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f1219]/95 via-[#0f1219]/78 to-[#0f1219]/35" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/60 to-transparent" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 pb-11 pt-12 sm:pt-14">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">~/gabinete</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Gabinete
          </h1>
          <p className="mt-3 max-w-xl font-serif text-lg italic text-white/70">
            Coleta seus processos, calcula seus prazos, analisa seus documentos. A máquina propõe,
            você dispõe.
          </p>
        </div>

        <StatGrid resumo={resumo} />
      </div>
    </header>
  );
}
