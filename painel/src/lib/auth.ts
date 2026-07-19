import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, bancoConectado } from "@/db";
import { usuarios, sessoes } from "@/db/schema";

const COOKIE = "gab_sessao";
const DIAS = 30;

export function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type UsuarioSessao = {
  id: string;
  email: string;
  nome: string | null;
  oab: string | null;
};

// Usuario logado do request atual (ou null). Valida a sessao no banco.
// Envolvido em cache() para deduplicar entre layout/pages no mesmo request.
export const getUsuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  if (!db) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nome: usuarios.nome,
      oab: usuarios.oab,
      expiraEm: sessoes.expiraEm,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .where(eq(sessoes.tokenHash, hashToken(token)))
    .limit(1);

  const s = rows[0];
  if (!s) return null;
  if (new Date(s.expiraEm) < new Date()) return null;

  return { id: s.id, email: s.email, nome: s.nome, oab: s.oab };
});

// Cria uma sessao para o usuario e grava o cookie. Retorna o token.
export async function criarSessao(usuarioId: string): Promise<void> {
  if (!db) throw new Error("Banco nao conectado");
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000);

  await db.insert(sessoes).values({
    usuarioId,
    tokenHash: hashToken(token),
    expiraEm,
  });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export async function destruirSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && db) {
    await db.delete(sessoes).where(eq(sessoes.tokenHash, hashToken(token)));
  }
  jar.delete(COOKIE);
}

// Protege uma pagina. Sem banco conectado, deixa passar (a UI mostra o estado
// "banco desconectado"); com banco e sem login, manda para /login.
export async function exigirLogin(): Promise<UsuarioSessao | null> {
  if (!bancoConectado()) return null;
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}
