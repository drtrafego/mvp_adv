"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  alterarMinhaSenha,
  criarAcesso,
  redefinirSenha,
  removerAcesso,
  type AcessoState,
} from "@/app/(app)/configuracoes/actions";
import type { AcessoRow } from "@/db/queries";

const inicial: AcessoState = {};

function Aviso({ state }: { state: AcessoState }) {
  if (state.erro) {
    return (
      <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
        {state.erro}
      </p>
    );
  }
  if (state.ok && state.msg) {
    return (
      <p className="inline-flex items-center gap-2 rounded-md border border-moss-brand/40 bg-moss-tint/60 px-3 py-2 text-sm text-moss-brand">
        <CheckCircle2 className="h-4 w-4" /> {state.msg}
      </p>
    );
  }
  return null;
}

function Campo({
  nome,
  rotulo,
  id,
  tipo = "text",
  obrigatorio = false,
  autoComplete,
  placeholder,
}: {
  nome: string;
  rotulo: string;
  /** id do input; só precisa ser passado quando o mesmo `nome` aparece mais de uma vez na página */
  id?: string;
  tipo?: string;
  obrigatorio?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const campoId = id ?? nome;
  return (
    <div className="space-y-1.5">
      <label htmlFor={campoId} className="text-sm font-medium">
        {rotulo}
      </label>
      <Input
        id={campoId}
        name={nome}
        type={tipo}
        required={obrigatorio}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Troca da própria senha: exige a senha atual e mantém este dispositivo logado. */
export function MinhaSenha() {
  const [state, action, pending] = useActionState(alterarMinhaSenha, inicial);

  return (
    <form action={action} className="space-y-4">
      <Aviso state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          nome="senha_atual"
          rotulo="Senha atual"
          tipo="password"
          obrigatorio
          autoComplete="current-password"
        />
        <Campo
          nome="nova"
          rotulo="Nova senha"
          tipo="password"
          obrigatorio
          autoComplete="new-password"
        />
        <Campo
          nome="confirma"
          rotulo="Repita a nova"
          tipo="password"
          obrigatorio
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={pending} className="gap-2">
        <KeyRound className="h-4 w-4" />
        {pending ? "Alterando..." : "Alterar senha"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Mínimo de 8 caracteres. Ao trocar, as sessões abertas em outros aparelhos caem.
      </p>
    </form>
  );
}

/** Lista de quem tem acesso, com redefinição de senha e remoção. */
export function ListaAcessos({
  acessos,
  usuarioAtualId,
}: {
  acessos: AcessoRow[];
  usuarioAtualId: string | null;
}) {
  if (acessos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum acesso cadastrado.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border">
      {acessos.map((a) => (
        <LinhaAcesso key={a.id} acesso={a} souEu={a.id === usuarioAtualId} />
      ))}
    </ul>
  );
}

function LinhaAcesso({ acesso, souEu }: { acesso: AcessoRow; souEu: boolean }) {
  const [abrirSenha, setAbrirSenha] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [stSenha, acSenha, pendSenha] = useActionState(redefinirSenha, inicial);
  const [stRemover, acRemover, pendRemover] = useActionState(removerAcesso, inicial);

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-medium">
            {acesso.nome ?? acesso.email}
            {souEu && (
              <span className="ml-2 rounded bg-indigo-tint px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-indigo-brand">
                você
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{acesso.email}</p>
          <p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
            {acesso.oab ? `OAB ${acesso.oab} · ` : ""}
            {acesso.sessoesAtivas > 0
              ? `${acesso.sessoesAtivas} sessão(ões) ativa(s)`
              : "sem sessão ativa"}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setAbrirSenha((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-indigo-brand/40"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {souEu ? "Redefinir" : "Redefinir senha"}
          </button>

          {!souEu &&
            (confirmando ? (
              <form action={acRemover}>
                <input type="hidden" name="id" value={acesso.id} />
                <button
                  type="submit"
                  disabled={pendRemover}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {pendRemover ? "Removendo..." : "Confirmar"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            ))}
        </div>
      </div>

      {abrirSenha && (
        <form action={acSenha} className="mt-4 space-y-3 rounded-lg bg-muted/40 p-4">
          <input type="hidden" name="id" value={acesso.id} />
          <Aviso state={stSenha} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              nome="nova"
              id={`nova-${acesso.id}`}
              rotulo="Nova senha"
              tipo="password"
              obrigatorio
              autoComplete="new-password"
            />
            <Campo
              nome="confirma"
              id={`confirma-${acesso.id}`}
              rotulo="Repita a senha"
              tipo="password"
              obrigatorio
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" size="sm" disabled={pendSenha}>
            {pendSenha ? "Salvando..." : "Definir nova senha"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Redefinir derruba todas as sessões dessa pessoa. Ela entra de novo com a senha nova.
          </p>
        </form>
      )}

      {stRemover.erro && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {stRemover.erro}
        </p>
      )}
    </li>
  );
}

/** Cadastro de um acesso novo. */
export function NovoAcesso() {
  const [state, action, pending] = useActionState(criarAcesso, inicial);

  return (
    <form action={action} className="space-y-4">
      <Aviso state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="email" rotulo="Email de acesso" tipo="email" obrigatorio autoComplete="off" />
        <Campo nome="nome" rotulo="Nome" placeholder="opcional" />
        <Campo nome="oab" rotulo="OAB" placeholder="opcional, ex: 11158-B/MT" />
        <div className="hidden sm:block" />
        <Campo nome="senha" rotulo="Senha inicial" tipo="password" obrigatorio autoComplete="new-password" />
        <Campo nome="confirma" rotulo="Repita a senha" tipo="password" obrigatorio autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={pending} className="gap-2">
        <UserPlus className="h-4 w-4" />
        {pending ? "Criando..." : "Criar acesso"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Quem recebe o acesso enxerga tudo do gabinete. Combine a senha inicial por um canal seguro e
        peça para ela ser trocada no primeiro acesso.
      </p>
    </form>
  );
}
