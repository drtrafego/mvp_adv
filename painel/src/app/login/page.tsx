"use client";

import { useActionState } from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fazerLogin, type LoginState } from "./actions";

const inicial: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(fazerLogin, inicial);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-tint text-indigo-brand">
            <Scale className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight">Gabinete</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso ao painel do escritório</p>
        </div>

        <form action={action} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          {state.erro && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {state.erro}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="senha" className="text-sm font-medium">
              Senha
            </label>
            <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          A máquina propõe, o profissional dispõe.
        </p>
      </div>
    </div>
  );
}
