/** Destino: painel/src/app/(app)/escritorio/page.tsx */
import { exigirLogin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EscritorioPage() {
  await exigirLogin();
  return (
    <main className="h-[calc(100dvh-1rem)] min-h-[640px] w-full p-2">
      <iframe
        title="Escritório virtual Daniel Felix — acompanhamento do Gabinete"
        src="/escritorio-visual/index.html?mode=gabinete"
        className="h-full w-full rounded-xl border-0"
        allow="fullscreen"
      />
    </main>
  );
}
