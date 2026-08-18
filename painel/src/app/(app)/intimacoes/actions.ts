"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comunicacoes } from "@/db/schema";
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
