"use client";

import { Briefcase, CalendarClock, Sparkles, AlarmClock, type LucideIcon } from "lucide-react";
import { StaggerGroup, StaggerItem } from "@/components/motion-primitives";

type Tom = "indigo" | "moss" | "amber" | "rose";

const tons: Record<Tom, { quadrado: string; numero: string }> = {
  indigo: { quadrado: "bg-indigo-300/15 text-indigo-200", numero: "text-white" },
  moss: { quadrado: "bg-emerald-300/15 text-emerald-200", numero: "text-white" },
  amber: { quadrado: "bg-amber-300/15 text-amber-200", numero: "text-amber-200" },
  rose: { quadrado: "bg-rose-300/15 text-rose-200", numero: "text-rose-200" },
};

export function StatGrid({
  resumo,
}: {
  resumo: { totalProcessos: number; prazosAbertos: number; sugeridos: number; venceEm7Dias: number };
}) {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat icon={Briefcase} n={resumo.totalProcessos} label="processos" tom="indigo" />
      <Stat icon={CalendarClock} n={resumo.prazosAbertos} label="prazos abertos" tom="moss" />
      <Stat icon={Sparkles} n={resumo.sugeridos} label="aguardando você" tom="amber" />
      <Stat icon={AlarmClock} n={resumo.venceEm7Dias} label="vencem em 7 dias" tom="rose" />
    </StaggerGroup>
  );
}

function Stat({
  icon: Icon,
  n,
  label,
  tom,
}: {
  icon: LucideIcon;
  n: number;
  label: string;
  tom: Tom;
}) {
  const t = tons[tom];
  return (
    <StaggerItem className="h-full">
      <div className="group h-full rounded-xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09]">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${t.quadrado}`}>
          <Icon className="h-[1.15rem] w-[1.15rem]" />
        </div>
        <div className={`mt-3 font-serif text-3xl font-semibold leading-none ${t.numero}`}>{n}</div>
        <div className="mt-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-white/55">
          {label}
        </div>
      </div>
    </StaggerItem>
  );
}
