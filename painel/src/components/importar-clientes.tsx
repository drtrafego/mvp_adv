"use client";

import { useActionState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importarClientes, type ImportState } from "@/app/(app)/configuracoes/actions";

const inicial: ImportState = {};

export function ImportarClientes() {
  const [state, action, pending] = useActionState(importarClientes, inicial);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-indigo-brand/40">
          <FileSpreadsheet className="h-4 w-4 text-indigo-brand" />
          <span>Escolher planilha</span>
          <input ref={inputRef} type="file" name="arquivo" accept=".csv,text/csv" className="sr-only"
            onChange={(e) => { e.currentTarget.form?.requestSubmit(); }} />
        </label>
        <Button type="submit" disabled={pending} className="gap-2">
          <Upload className="h-4 w-4" />
          {pending ? "Importando..." : "Importar"}
        </Button>
      </div>

      {state.erro && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {state.erro}
        </p>
      )}
      {state.ok && state.msg && (
        <p className="inline-flex items-center gap-2 rounded-md border border-moss-brand/40 bg-moss-tint/60 px-3 py-2 text-sm text-moss-brand">
          <CheckCircle2 className="h-4 w-4" /> {state.msg}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Formato: CSV com uma coluna <span className="font-mono">nome</span> (obrigatória) e, se quiser,{" "}
        <span className="font-mono">cpf/cnpj</span>, <span className="font-mono">email</span> e{" "}
        <span className="font-mono">telefone</span>. No Excel ou Google Sheets: Arquivo → Salvar como / Baixar como CSV.
      </p>
    </form>
  );
}
