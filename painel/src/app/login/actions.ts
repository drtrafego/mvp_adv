"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { verificarSenha, criarSessao, destruirSessao } from "@/lib/auth";

export type LoginState = { erro?: string };

export async function fazerLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!db) return { erro: "Banco não conectado. Defina DATABASE_URL." };
  if (!email || !senha) return { erro: "Preencha email e senha." };

  const encontrado = (
    await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1)
  )[0];

  if (!encontrado || !(await verificarSenha(senha, encontrado.senhaHash))) {
    return { erro: "Email ou senha incorretos." };
  }

  await criarSessao(encontrado.id);
  redirect("/");
}

export async function fazerLogout(): Promise<void> {
  await destruirSessao();
  redirect("/login");
}
