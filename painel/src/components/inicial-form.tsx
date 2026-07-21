"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { iniciarInicialAction } from "@/app/actions";

export function InicialForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cliente, setCliente] = useState("");
  const [fatos, setFatos] = useState("");

  function montar() {
    if (!fatos.trim()) {
      toast.error("Descreva os fatos do caso.");
      return;
    }
    start(async () => {
      const r = await iniciarInicialAction({ clienteNome: cliente, fatos });
      if (r.ok && r.id) {
        toast.success("Inicial iniciada. Siga o comando para montar a tese e o rascunho.");
        router.push(`/pe/${r.id}`);
      } else {
        toast.error(r.erro ?? "Falha ao iniciar.");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <label className="block text-sm">
        <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
          Cliente (opcional)
        </span>
        <Input
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Nome do cliente do caso novo"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
          Fatos do caso
        </span>
        <Textarea
          value={fatos}
          onChange={(e) => setFatos(e.target.value)}
          rows={8}
          placeholder="Descreva o que aconteceu: as partes, os fatos relevantes, datas, documentos que o cliente tem. O construtor-tese usa isto para montar a tese jurídica, os pedidos e a viabilidade."
        />
      </label>
      <Button onClick={montar} disabled={pending} className="gap-2">
        <Sparkles className="h-4 w-4" /> {pending ? "Iniciando..." : "Montar a inicial"}
      </Button>
    </div>
  );
}
