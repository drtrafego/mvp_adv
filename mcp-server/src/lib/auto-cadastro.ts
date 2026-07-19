/**
 * Auto-cadastro de processos a partir das intimações do DJEN.
 *
 * Para cada comunicação com número de processo válido: se o processo ainda não está na
 * carteira, consulta o DataJud, grava a capa e as movimentações e vincula a comunicação; se
 * já existe, só vincula. É organização de metadado público, NÃO cria prazo (prazo só nasce
 * pelo fluxo prazos-cpc + calcular_prazo, sugerido/amarelo, com confirmação humana).
 *
 * Roda sob comando (tool processar_intimacoes), nunca automático dentro de buscar_intimacoes.
 */

import type { ComunicacaoDJEN } from "./comunica.js";
import { consultarProcesso } from "./datajud.js";
import { validarCNJ } from "./cnj.js";
import {
  bancoConfigurado,
  processoExistente,
  upsertProcesso,
  upsertMovimentacoes,
  vincularComunicacao,
} from "./db.js";

export interface ResultadoAutoCadastro {
  /** Processos novos criados na carteira a partir das intimações. */
  criados: number;
  /** Comunicações vinculadas a um processo (novo ou já existente). */
  vinculados: number;
}

export async function autocadastrarDeComunicacoes(
  comuns: ComunicacaoDJEN[],
): Promise<ResultadoAutoCadastro> {
  if (!bancoConfigurado()) {
    // Sem banco não há carteira para cadastrar nem vincular. Avisa no stderr (stdout é o
    // canal do protocolo MCP) e devolve zerado.
    console.error("[auto-cadastro] Banco (Neon) não configurado; nada a cadastrar ou vincular.");
    return { criados: 0, vinculados: 0 };
  }

  let criados = 0;
  let vinculados = 0;

  for (const c of comuns) {
    const numero = c.numeroProcesso;
    if (!numero || !validarCNJ(numero)) continue;

    let procId = await processoExistente(numero);
    if (!procId) {
      const p = await consultarProcesso(numero);
      const { id } = await upsertProcesso(p);
      await upsertMovimentacoes(id, p.movimentacoes);
      procId = id;
      criados++;
    }

    if (c.hash) {
      await vincularComunicacao(c.hash, procId);
      vinculados++;
    }
  }

  return { criados, vinculados };
}
