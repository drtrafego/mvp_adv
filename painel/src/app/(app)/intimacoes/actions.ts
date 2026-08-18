"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { analises, comunicacoes } from "@/db/schema";
import { getUsuarioAtual } from "@/lib/auth";

/**
 * Baixa a intimação da fila de pendências sem criar prazo nenhum. É o caso de ciência,
 * mero expediente ou juntada: o advogado leu e não há ato a praticar. Não confirma nem
 * calcula nada, só registra que aquilo já foi visto.
 */
export async function marcarCuidada(formData: FormData): Promise<void> {
  await alternarProcessada(formData, true);
}

/** Devolve a intimação para a fila, se foi baixada por engano. */
export async function reabrirIntimacao(formData: FormData): Promise<void> {
  await alternarProcessada(formData, false);
}

async function alternarProcessada(formData: FormData, valor: boolean): Promise<void> {
  if (!db) return;
  if (!(await getUsuarioAtual())) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.update(comunicacoes).set({ processada: valor }).where(eq(comunicacoes.id, id));

  // A intimação aparece na Início, na aba Prazos e na aba Intimações: as três revalidam juntas.
  revalidatePath("/");
  revalidatePath("/prazos");
  revalidatePath("/intimacoes");
  revalidatePath(`/i/${id}`);
}

/**
 * O advogado assume a pré-análise: ela vira humana (verde) e a máquina não mexe mais.
 * A análise não é editada campo a campo aqui; confirmar é dizer "li e concordo".
 */
export async function confirmarAnaliseAction(formData: FormData): Promise<void> {
  await decidirAnalise(formData, "confirmada");
}

/** O advogado descarta a pré-análise: some dos selos e a intimação volta a contar como não lida. */
export async function descartarAnaliseAction(formData: FormData): Promise<void> {
  await decidirAnalise(formData, "descartada");
}

async function decidirAnalise(formData: FormData, status: "confirmada" | "descartada"): Promise<void> {
  if (!db) return;
  const usuario = await getUsuarioAtual();
  if (!usuario) return;

  const analiseId = String(formData.get("id") ?? "");
  if (!analiseId) return;

  const [alvo] = await db
    .update(analises)
    .set({
      status,
      origem: "humana",
      editadoPor: usuario.nome ?? usuario.email,
      editadoEm: new Date(),
    })
    .where(eq(analises.id, analiseId))
    .returning({ comunicacaoId: analises.comunicacaoId });

  revalidatePath("/");
  revalidatePath("/intimacoes");
  revalidatePath("/analises");
  if (alvo?.comunicacaoId) revalidatePath(`/i/${alvo.comunicacaoId}`);
}
