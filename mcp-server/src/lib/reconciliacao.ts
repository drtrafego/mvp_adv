/**
 * Redundância grátis: reconcilia o DataJud com a Comunica/DJEN.
 *
 * Toda intimação vira, com defasagem, uma movimentação no DataJud (fonte, transporte e
 * autenticação diferentes, não compartilham modo de falha). Um ato intimatório no DataJud
 * SEM comunicação correspondente na Comunica dispara alerta de "possível intimação não
 * capturada".
 *
 * Regra de ouro: aqui SÓ se ALERTA. Nunca cria prazo sozinho.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { bancoConfigurado, getDb } from "./db.js";
import * as schema from "./schema.js";
import { formatarCNJ } from "./cnj.js";

// Palavras que caracterizam um ato intimatório no texto do movimento do DataJud.
const REGEX_INTIMATORIO = /intima|cita[cç][aã]o|notific|publica[cç][aã]o|expedi[cç][aã]o de/i;
// Códigos CNJ da Tabela de Movimentos ligados a intimação/citação/publicação.
const CODIGOS_INTIMATORIOS = new Set<number>([
  12265, // Intimação
  12266, // Ato ordinatório
  12441, // Citação
  851, // Publicação
  60, // Expedição de documento
  970, // Juntada (às vezes de intimação)
]);

// Janela: a comunicação (disponibilização no DJEN) costuma vir ANTES do movimento no
// DataJud. Aceita uma comunicação do processo entre `movData - antes` e `movData + depois`.
const DIAS_ANTES = 45;
const DIAS_DEPOIS = 7;

export interface AlertaReconciliacao {
  numeroCnj: string;
  clienteNome: string | null;
  movimentacao: string;
  dataMovimentacao: string;
  motivo: string;
}

export interface ResultadoReconciliacao {
  analisadas: number;
  intimatorias: number;
  alertas: AlertaReconciliacao[];
}

function ehIntimatorio(codigo: number | null, descricao: string): boolean {
  if (codigo != null && CODIGOS_INTIMATORIOS.has(codigo)) return true;
  return REGEX_INTIMATORIO.test(descricao);
}

function diffDias(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Cruza movimentações intimatórias do DataJud contra as comunicações do DJEN.
 * `numeroCnj` limita a um processo; `desde` (YYYY-MM-DD) limita a janela de movimentos.
 */
export async function reconciliarIntimacoes(opts: {
  numeroCnj?: string;
  desde?: string;
} = {}): Promise<ResultadoReconciliacao> {
  const d = getDb();

  const conds = [eq(schema.movimentacoes.fonte, "datajud")];
  if (opts.desde) conds.push(gte(schema.movimentacoes.dataHora, new Date(opts.desde)));

  const movs = await d
    .select({
      movId: schema.movimentacoes.id,
      codigo: schema.movimentacoes.codigoCnj,
      descricao: schema.movimentacoes.descricao,
      dataHora: schema.movimentacoes.dataHora,
      processoId: schema.processos.id,
      numeroCnj: schema.processos.numeroCnj,
      clienteNome: schema.processos.clienteNome,
    })
    .from(schema.movimentacoes)
    .innerJoin(schema.processos, eq(schema.movimentacoes.processoId, schema.processos.id))
    .where(
      opts.numeroCnj
        ? and(...conds, eq(schema.processos.numeroCnj, formatarCNJ(opts.numeroCnj)))
        : and(...conds),
    )
    .orderBy(desc(schema.movimentacoes.dataHora));

  const intimatorias = movs.filter((m) => ehIntimatorio(m.codigo, m.descricao));
  const alertas: AlertaReconciliacao[] = [];

  // Cache de comunicações por processo, para não reconsultar.
  const cacheComuns = new Map<string, Date[]>();

  for (const m of intimatorias) {
    const pid = m.processoId;
    if (!cacheComuns.has(pid)) {
      const comuns = await d
        .select({ data: schema.comunicacoes.dataDisponibilizacao })
        .from(schema.comunicacoes)
        .where(eq(schema.comunicacoes.processoId, pid));
      const datas = comuns
        .map((c) => (c.data ? new Date(c.data as string) : null))
        .filter((x): x is Date => x !== null);
      cacheComuns.set(pid, datas);
    }
    const datasComuns = cacheComuns.get(pid) ?? [];
    const movData = m.dataHora as Date;

    const temCorrespondente = datasComuns.some((dc) => {
      const delta = diffDias(movData, dc); // >0 = comunicação antes do movimento
      return delta >= -DIAS_DEPOIS && delta <= DIAS_ANTES;
    });

    if (!temCorrespondente) {
      alertas.push({
        numeroCnj: m.numeroCnj,
        clienteNome: m.clienteNome,
        movimentacao: m.descricao,
        dataMovimentacao: movData.toISOString().slice(0, 10),
        motivo:
          datasComuns.length === 0
            ? "Processo sem nenhuma comunicação capturada no DJEN"
            : `Nenhuma comunicação do DJEN na janela de ${DIAS_ANTES} dias antes a ${DIAS_DEPOIS} depois`,
      });
    }
  }

  return { analisadas: movs.length, intimatorias: intimatorias.length, alertas };
}

export { bancoConfigurado };
