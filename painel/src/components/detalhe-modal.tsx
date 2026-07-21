"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/** Wrapper de modal reutilizável para os detalhes (peça, cliente, prazo). */
export function DetalheModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) router.back();
      }}
    >
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-y-auto p-0 max-h-[90vh] sm:max-w-3xl max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:h-[93dvh] max-sm:max-h-[93dvh] max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        {children}
      </DialogContent>
    </Dialog>
  );
}
