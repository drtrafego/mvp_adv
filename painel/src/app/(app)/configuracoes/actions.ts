"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes } from "@/db/schema";

export type ImportState = { ok?: boolean; erro?: string; msg?: string };

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
