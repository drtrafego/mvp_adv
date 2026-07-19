"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/** Barra superior fixa: monograma + nome, chip de status e tema. Ganha blur ao rolar. */
export function Topbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-background/80 text-foreground backdrop-blur-md"
          : "border-b border-transparent text-white",
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-brand font-serif text-base font-semibold text-white shadow-sm"
            aria-hidden
          >
            G
          </span>
          <div className="leading-tight">
            <div className="font-serif text-[0.95rem] font-semibold">Gabinete</div>
            <div
              className={cn(
                "font-mono text-[0.6rem] uppercase tracking-[0.18em] transition-colors",
                scrolled ? "text-muted-foreground" : "text-white/60",
              )}
            >
              painel do escritório
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wide transition-colors sm:inline-flex",
              scrolled
                ? "border-moss-brand/30 bg-moss-tint/60 text-moss-brand"
                : "border-white/20 bg-white/10 text-white/80",
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-moss-brand/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-moss-brand" />
            </span>
            sincronizado
          </span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
