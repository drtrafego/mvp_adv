"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Scale,
  Inbox,
  FileSearch,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileSignature,
  FilePlus2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BuscaGlobal } from "@/components/busca-global";
import { fazerLogout } from "@/app/login/actions";
import { cn } from "@/lib/utils";
import type { UsuarioSessao } from "@/lib/auth";

const SETORES = [
  { href: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/prazos", label: "Prazos", icon: CalendarClock },
  { href: "/processos", label: "Processos", icon: Scale },
  { href: "/pecas", label: "Peças", icon: FileSignature },
  { href: "/inicial", label: "Inicial", icon: FilePlus2 },
  { href: "/intimacoes", label: "Intimações", icon: Inbox },
  { href: "/analises", label: "Análises", icon: FileSearch },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function iniciais(nome: string | null | undefined): string {
  if (!nome) return "G";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function Cabecalho() {
  return (
    <div className="border-b border-border p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-brand font-serif text-base font-semibold text-white shadow-sm">
          G
        </span>
        <div className="leading-tight">
          <div className="font-serif text-[0.95rem] font-semibold">Gabinete</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            painel do escritório
          </div>
        </div>
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-moss-brand/30 bg-moss-tint/60 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-moss-brand">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-moss-brand/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-moss-brand" />
        </span>
        sincronizado
      </span>
    </div>
  );
}

function SidebarNav({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      <div className="mb-1 px-0.5">
        <BuscaGlobal onNav={onNav} />
      </div>
      {SETORES.map((s) => {
        const ativo = s.exact ? pathname === s.href : pathname.startsWith(s.href);
        const Icon = s.icon;
        return (
          <Link
            key={s.href}
            href={s.href}
            onClick={onNav}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-indigo-tint text-indigo-brand"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {ativo && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-indigo-brand" />
            )}
            <Icon
              className={cn(
                "h-5 w-5 shrink-0",
                ativo ? "text-indigo-brand" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Rodape({ usuario }: { usuario: UsuarioSessao | null }) {
  return (
    <div className="mt-auto border-t border-border p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-tint font-serif text-sm font-semibold text-indigo-brand">
          {iniciais(usuario?.nome ?? usuario?.email)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-serif text-sm font-medium">
            {usuario?.nome ?? usuario?.email ?? "Advogado"}
          </div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            titular
          </div>
        </div>
        <ThemeToggle />
      </div>
      <form action={fazerLogout} className="mt-3">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </form>
    </div>
  );
}

export function Sidebar({
  usuario,
  children,
}: {
  usuario: UsuarioSessao | null;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-card">
        <Cabecalho />
        <SidebarNav />
        <Rodape usuario={usuario} />
      </aside>

      {/* Coluna de conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-brand font-serif text-sm font-semibold text-white">
              G
            </span>
            <span className="font-serif text-sm font-semibold">Gabinete</span>
          </div>
          <ThemeToggle />
        </div>

        <main className="flex-1">{children}</main>
      </div>

      {/* Drawer mobile */}
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setAberto(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-brand font-serif text-base font-semibold text-white">
                  G
                </span>
                <span className="font-serif text-[0.95rem] font-semibold">Gabinete</span>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav onNav={() => setAberto(false)} />
            <Rodape usuario={usuario} />
          </aside>
        </div>
      )}
    </div>
  );
}
