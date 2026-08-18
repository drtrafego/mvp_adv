"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  User,
  Check,
  FolderOpen,
  StickyNote,
  FileText,
  Building2,
  Bot,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnotacoesBloco } from "@/components/anotacoes-bloco";
import { atualizarClienteAction, adicionarAnotacaoClienteAction } from "@/app/actions";
import type { DetalheCliente } from "@/db/queries";

type Processo = DetalheCliente["processos"][number];
type Documento = DetalheCliente["documentos"][number];
type Peca = DetalheCliente["pecas"][number];

function formatarDataHora(d: Date | string | null): string {
  if (!d) return "-";
  const data = new Date(d);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClienteDetalhe({ detalhe }: { detalhe: DetalheCliente }) {
  const { cliente, processos, documentos, anotacoes, pecas } = detalhe;
  const sugeridos = processos.filter((p) => p.vinculo === "maquina").length;

  return (
    <div className="flex flex-col">
      <div className="border-b bg-muted/30 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-tint text-indigo-brand">
            <User className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl font-semibold leading-tight">{cliente.nome}</h2>
            {cliente.documento && (
              <p className="font-mono text-xs text-muted-foreground">
                {cliente.tipoDocumento?.toUpperCase() ?? "doc"}: {cliente.documento}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            {processos.length} {processos.length === 1 ? "processo" : "processos"} ·{" "}
            {documentos.length} {documentos.length === 1 ? "documento" : "documentos"}
          </span>
          {/* Amarelo: vínculo deduzido pela máquina, ainda esperando a palavra do advogado. */}
          {sugeridos > 0 && (
            <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
              <Bot className="mr-1 h-3 w-3" /> {sugeridos} vínculo(s) sugerido(s)
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="dados" className="px-4 pb-6 sm:px-6">
        <TabsList variant="line" className="mb-4 flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="dados">
            <User /> Dados
          </TabsTrigger>
          <TabsTrigger value="processos">
            <FolderOpen /> Processos
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <Paperclip /> Documentos
          </TabsTrigger>
          <TabsTrigger value="pecas">
            <FileText /> Peças
          </TabsTrigger>
          <TabsTrigger value="anotacoes">
            <StickyNote /> Anotações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <FormDados cliente={cliente} />
        </TabsContent>
        <TabsContent value="processos">
          <ListaProcessos processos={processos} />
        </TabsContent>
        <TabsContent value="documentos">
          <ListaDocumentos documentos={documentos} />
        </TabsContent>
        <TabsContent value="anotacoes">
          <AnotacoesBloco
            anotacoes={anotacoes}
            onAdd={(t) => adicionarAnotacaoClienteAction(cliente.id, t)}
            placeholder="Nota sobre este cliente"
          />
        </TabsContent>
        <TabsContent value="pecas">
          <ListaPecas pecas={pecas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormDados({ cliente }: { cliente: DetalheCliente["cliente"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nome, setNome] = useState(cliente.nome);
  const [documento, setDocumento] = useState(cliente.documento ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [telefone, setTelefone] = useState(cliente.telefone ?? "");
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? "");

  function salvar() {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    start(async () => {
      const r = await atualizarClienteAction(cliente.id, {
        nome,
        documento,
        email,
        telefone,
        observacoes,
      });
      if (r.ok) toast.success("Cliente atualizado.");
      else toast.error(r.erro ?? "Falha.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Nome</span>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Documento (CPF/CNPJ)</span>
          <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">E-mail</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Telefone</span>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Observações</span>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </label>
      <Button size="sm" onClick={salvar} disabled={pending}>
        <Check /> Salvar cliente
      </Button>
    </div>
  );
}

function ListaProcessos({ processos }: { processos: Processo[] }) {
  if (processos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhum processo vinculado a este cliente.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {processos.map((p) => (
        <li key={p.id}>
          <Link
            href={`/p/${p.id}`}
            className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/40 ${
              p.vinculo === "maquina" ? "border-amber-brand/40 bg-amber-tint/40" : "bg-card"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono">{p.numeroCnj}</span>
              {p.papel && (
                <span className="shrink-0 text-xs text-muted-foreground">{p.papel}</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {p.vinculo === "maquina" && (
                <Badge className="border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
                  <Bot className="mr-1 h-3 w-3" /> sugerido
                </Badge>
              )}
              {p.vinculo === "humana" && (
                <ShieldCheck className="h-3.5 w-3.5 text-moss-brand" aria-label="vínculo confirmado" />
              )}
              {/* Legado: o processo casa só pelo nome no cache, sem vínculo relacional. */}
              {p.vinculo === "nome" && (
                <Badge variant="outline" className="text-[0.6rem] uppercase">
                  vínculo só por nome
                </Badge>
              )}
              <Badge variant="outline" className="text-[0.6rem] uppercase">
                {p.status ?? "ativo"}
              </Badge>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A pasta do cliente: documento do processo, da peça ou anexado direto a ele. */
function ListaDocumentos({ documentos }: { documentos: Documento[] }) {
  if (documentos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhum documento na pasta deste cliente. Os documentos entram pelos processos vinculados,
        pelas peças, ou anexados direto ao cliente.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {documentos.map((d) => {
        const linha = (
          <>
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {d.titulo ?? "documento sem título"}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {d.categoria && <span className="capitalize">{d.categoria}</span>}
                {d.numeroCnj && <span className="font-mono">· {d.numeroCnj}</span>}
                {d.pecaId && !d.processoId && <span>· peça</span>}
                <span>· {formatarDataHora(d.dataDocumento ?? d.createdAt)}</span>
                {d.tamanhoBytes ? <span>· {(d.tamanhoBytes / 1024).toFixed(0)} KB</span> : null}
              </span>
            </span>
          </>
        );
        return (
          <li key={d.id}>
            {d.processoId ? (
              <Link
                href={`/p/${d.processoId}/doc/${d.id}`}
                className="flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                {linha}
              </Link>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border bg-card p-3">{linha}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListaPecas({ pecas }: { pecas: Peca[] }) {
  if (pecas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhuma peça deste cliente ainda.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {pecas.map((p) => (
        <li key={p.id}>
          <Link
            href={`/pe/${p.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-indigo-brand" />
              <span className="truncate capitalize">{p.titulo ?? p.tipo}</span>
            </span>
            {p.origem === "humana" ? (
              <Badge className="shrink-0 border border-moss-brand/30 bg-moss-tint text-[0.6rem] uppercase text-moss-brand">
                aprovada
              </Badge>
            ) : (
              <Badge className="shrink-0 border border-amber-brand/30 bg-amber-tint text-[0.6rem] uppercase text-amber-brand">
                <Bot className="mr-1 h-3 w-3" /> {p.status}
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
