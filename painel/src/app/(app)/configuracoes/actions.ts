"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, usuarios } from "@/db/schema";
import {
  encerrarSessoes,
  getUsuarioAtual,
  hashSenha,
  verificarSenha,
} from "@/lib/auth";

export type ImportState = { ok?: boolean; erro?: string; msg?: string };
export type AcessoState = { ok?: boolean; erro?: string; msg?: string };

// remove acentos e baixa caixa, para casar cabeçalhos independente da escrita
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Parser de CSV que respeita aspas e detecta o separador (vírgula ou ponto e vírgula).
function parseCSV(texto: string): Record<string, string>[] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const linhas = limpo.split("\n").filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];
  const sep = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const parseLinha = (linha: string): string[] => {
    const campos: string[] = [];
    let atual = "";
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (aspas && linha[i + 1] === '"') { atual += '"'; i++; }
        else aspas = !aspas;
      } else if (c === sep && !aspas) {
        campos.push(atual); atual = "";
      } else atual += c;
    }
    campos.push(atual);
    return campos.map((s) => s.trim());
  };

  const cabecalho = parseLinha(linhas[0]).map(norm);
  return linhas.slice(1).map((l) => {
    const valores = parseLinha(l);
    const obj: Record<string, string> = {};
    cabecalho.forEach((h, i) => (obj[h] = valores[i] ?? ""));
    return obj;
  });
}

// mapeia uma linha da planilha para os campos do cliente, aceitando vários nomes de coluna
function mapear(row: Record<string, string>) {
  const pega = (...chaves: string[]) => {
    for (const k of chaves) {
      const achou = Object.keys(row).find((h) => h === k || h.includes(k));
      if (achou && row[achou]) return row[achou].trim();
    }
    return "";
  };
  const nome = pega("nome", "cliente", "razao social", "name");
  const documento = pega("cpf/cnpj", "cpf_cnpj", "documento", "cnpj", "cpf");
  const email = pega("email", "e-mail");
  const telefone = pega("telefone", "celular", "whatsapp", "fone", "tel");
  const tipoDoc = documento.replace(/\D/g, "").length > 11 ? "CNPJ" : documento ? "CPF" : null;
  return { nome, documento: documento || null, email: email || null, telefone: telefone || null, tipoDocumento: tipoDoc };
}

export async function importarClientes(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { erro: "Escolha um arquivo CSV para importar." };
  if (!db) return { erro: "Banco não conectado." };

  let linhas: Record<string, string>[];
  try {
    linhas = parseCSV(await file.text());
  } catch {
    return { erro: "Não consegui ler o arquivo. Salve a planilha como CSV e tente de novo." };
  }
  if (linhas.length === 0) return { erro: "A planilha está vazia ou sem cabeçalho." };

  const registros = linhas.map(mapear).filter((r) => r.nome);
  if (registros.length === 0)
    return { erro: "Não achei a coluna de nome. A planilha precisa ter uma coluna 'nome' (e opcionalmente cpf/cnpj, email, telefone)." };

  // dedup: não reimporta quem já existe (por documento, senão por nome)
  const existentes = await db.select({ nome: clientes.nome, documento: clientes.documento }).from(clientes);
  const docsExist = new Set(existentes.map((c) => (c.documento ?? "").replace(/\D/g, "")).filter(Boolean));
  const nomesExist = new Set(existentes.map((c) => norm(c.nome)));

  const novos = registros.filter((r) => {
    const doc = (r.documento ?? "").replace(/\D/g, "");
    if (doc && docsExist.has(doc)) return false;
    if (!doc && nomesExist.has(norm(r.nome))) return false;
    return true;
  });

  if (novos.length > 0) {
    await db.insert(clientes).values(novos);
  }

  revalidatePath("/clientes");
  const jaExistiam = registros.length - novos.length;
  return {
    ok: true,
    msg: `${novos.length} cliente(s) importado(s)` + (jaExistiam > 0 ? `, ${jaExistiam} já estavam cadastrados.` : "."),
  };
}

/* -------------------------------------------------------------------------- */
/* Acesso ao sistema                                                           */
/* -------------------------------------------------------------------------- */

const MIN_SENHA = 8;

// Toda ação de acesso exige estar logado: quem já tem acesso administra o acesso.
async function exigirSessao() {
  if (!db) return { erro: "Banco não conectado." as const };
  const atual = await getUsuarioAtual();
  if (!atual) return { erro: "Sessão expirada. Entre de novo." as const };
  return { atual };
}

function validarSenha(nova: string, confirma: string): string | null {
  if (nova.length < MIN_SENHA) return `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`;
  if (nova !== confirma) return "A confirmação não bate com a nova senha.";
  return null;
}

/** O próprio usuário troca a senha. Exige a senha atual e derruba os outros dispositivos. */
export async function alterarMinhaSenha(
  _prev: AcessoState,
  formData: FormData,
): Promise<AcessoState> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return { erro: sessao.erro };
  const { atual } = sessao;

  const senhaAtual = String(formData.get("senha_atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  const invalida = validarSenha(nova, confirma);
  if (invalida) return { erro: invalida };

  const registro = (
    await db!.select().from(usuarios).where(eq(usuarios.id, atual.id)).limit(1)
  )[0];
  if (!registro || !(await verificarSenha(senhaAtual, registro.senhaHash))) {
    return { erro: "Senha atual incorreta." };
  }
  if (await verificarSenha(nova, registro.senhaHash)) {
    return { erro: "A nova senha é igual à atual." };
  }

  await db!
    .update(usuarios)
    .set({ senhaHash: await hashSenha(nova) })
    .where(eq(usuarios.id, atual.id));
  await encerrarSessoes(atual.id, true);

  revalidatePath("/configuracoes");
  return { ok: true, msg: "Senha alterada. Os outros dispositivos foram desconectados." };
}

/** Cria um acesso novo (o titular cadastra sócio, secretária ou estagiário). */
export async function criarAcesso(
  _prev: AcessoState,
  formData: FormData,
): Promise<AcessoState> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return { erro: sessao.erro };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const oab = String(formData.get("oab") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe um email válido." };
  const invalida = validarSenha(senha, confirma);
  if (invalida) return { erro: invalida };

  const jaExiste = (
    await db!.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).limit(1)
  )[0];
  if (jaExiste) return { erro: "Já existe um acesso com esse email." };

  await db!.insert(usuarios).values({
    email,
    senhaHash: await hashSenha(senha),
    nome: nome || null,
    oab: oab || null,
  });

  revalidatePath("/configuracoes");
  return { ok: true, msg: `Acesso criado para ${email}. Passe a senha por um canal seguro.` };
}

/** Redefine a senha de outro acesso (esqueceu a senha). Derruba as sessões dele. */
export async function redefinirSenha(
  _prev: AcessoState,
  formData: FormData,
): Promise<AcessoState> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return { erro: sessao.erro };

  const id = String(formData.get("id") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  const invalida = validarSenha(nova, confirma);
  if (invalida) return { erro: invalida };

  const alvo = (
    await db!.select({ email: usuarios.email }).from(usuarios).where(eq(usuarios.id, id)).limit(1)
  )[0];
  if (!alvo) return { erro: "Acesso não encontrado." };

  await db!.update(usuarios).set({ senhaHash: await hashSenha(nova) }).where(eq(usuarios.id, id));
  await encerrarSessoes(id);

  revalidatePath("/configuracoes");
  return { ok: true, msg: `Senha de ${alvo.email} redefinida.` };
}

/** Remove um acesso. As sessões caem junto (ON DELETE CASCADE). */
export async function removerAcesso(
  _prev: AcessoState,
  formData: FormData,
): Promise<AcessoState> {
  const sessao = await exigirSessao();
  if ("erro" in sessao) return { erro: sessao.erro };
  const { atual } = sessao;

  const id = String(formData.get("id") ?? "");
  if (id === atual.id) return { erro: "Você não pode remover o seu próprio acesso." };

  const total = (await db!.select({ n: sql<number>`count(*)::int` }).from(usuarios))[0]?.n ?? 0;
  if (total <= 1) return { erro: "Este é o último acesso do sistema. Crie outro antes de remover." };

  const alvo = (
    await db!.select({ email: usuarios.email }).from(usuarios).where(eq(usuarios.id, id)).limit(1)
  )[0];
  if (!alvo) return { erro: "Acesso não encontrado." };

  await db!.delete(usuarios).where(eq(usuarios.id, id));

  revalidatePath("/configuracoes");
  return { ok: true, msg: `Acesso de ${alvo.email} removido.` };
}
