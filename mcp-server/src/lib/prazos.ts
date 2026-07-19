/**
 * Motor determinístico de prazos processuais.
 *
 * Princípio do Gabinete: a IA classifica o ato (quantos dias, se em dobro), o CÓDIGO calcula
 * a data fatal. Nenhum campo crítico sai de LLM. Aqui é só aritmética de calendário.
 *
 * Regras aplicadas:
 * - Lei 11.419/2006, art. 4º, §3º: publicação = primeiro dia útil seguinte à disponibilização.
 * - Lei 11.419/2006, art. 4º, §4º + CPC art. 224, §3º: a contagem começa no primeiro dia útil
 *   seguinte à data de publicação (exclui-se o dia do começo, inclui-se o do vencimento).
 * - CPC art. 219: prazos processuais contam-se em DIAS ÚTEIS.
 * - CPC art. 220: suspensão de 20/12 a 20/01 (tratada no calendário como não-útil).
 * - Prazo em dobro: dias x 2 (ex.: Fazenda Pública art. 183, MP art. 180, Defensoria art. 186,
 *   litisconsortes com procuradores distintos em autos físicos art. 229).
 */

import {
  addDays,
  criarCalendario,
  formatISODate,
  parseISODate,
  type CalendarioOptions,
} from "./feriados.js";

export type Contagem = "uteis" | "corridos";

export interface CalcularPrazoInput {
  /** Data de disponibilização no DJEN, 'YYYY-MM-DD' (o que a Comunica retorna). */
  dataDisponibilizacao: string;
  /** Número de dias do prazo (antes de eventual dobro). */
  dias: number;
  /** 'uteis' (padrão, CPC art. 219) ou 'corridos' (prazos em dias corridos, casos específicos). */
  contagem?: Contagem;
  /** Aplica prazo em dobro. */
  dobro?: boolean;
  /**
   * Se a publicação já é conhecida (ex.: ciência pessoal em audiência), informar aqui e
   * pular a etapa de disponibilização→publicação. Formato 'YYYY-MM-DD'.
   */
  dataPublicacaoConhecida?: string;
  /** Opções de calendário (feriados forenses locais do tribunal etc.). */
  calendario?: CalendarioOptions;
}

export interface CalcularPrazoResult {
  dataDisponibilizacao: string | null;
  dataPublicacao: string;
  dataInicioContagem: string;
  dataFatal: string;
  dias: number;
  diasEfetivos: number;
  contagem: Contagem;
  dobro: boolean;
  /** Passo a passo legível, para auditoria e para o painel mostrar a justificativa. */
  memoria: string[];
}

/**
 * Calcula a data fatal de um prazo processual de forma determinística.
 */
export function calcularPrazo(input: CalcularPrazoInput): CalcularPrazoResult {
  const contagem: Contagem = input.contagem ?? "uteis";
  const dobro = input.dobro ?? false;
  const diasEfetivos = dobro ? input.dias * 2 : input.dias;
  const cal = criarCalendario(input.calendario);
  const memoria: string[] = [];

  if (diasEfetivos <= 0) {
    throw new Error("O prazo precisa ter ao menos 1 dia.");
  }

  // 1. Data de publicação
  let dataPublicacao: Date;
  if (input.dataPublicacaoConhecida) {
    dataPublicacao = parseISODate(input.dataPublicacaoConhecida);
    memoria.push(`Publicação informada diretamente: ${formatISODate(dataPublicacao)}.`);
  } else {
    const disp = parseISODate(input.dataDisponibilizacao);
    dataPublicacao = cal.proximoDiaUtil(disp);
    memoria.push(
      `Disponibilização em ${formatISODate(disp)}. Publicação = primeiro dia útil seguinte ` +
        `(Lei 11.419/06 art. 4º §3º): ${formatISODate(dataPublicacao)}.`,
    );
  }

  if (contagem === "corridos") {
    // Prazos em dias corridos: soma direta; se cair em dia não útil, prorroga para o próximo (CPC art. 224 §1º).
    const inicio = addDays(dataPublicacao, 1);
    memoria.push(`Contagem em dias CORRIDOS a partir de ${formatISODate(inicio)}.`);
    let fatal = addDays(inicio, diasEfetivos - 1);
    if (!cal.ehDiaUtil(fatal)) {
      const prorrogada = cal.diaUtilOuProximo(fatal);
      memoria.push(
        `Vencimento em ${formatISODate(fatal)} cai em dia não útil; prorroga para ` +
          `${formatISODate(prorrogada)} (CPC art. 224 §1º).`,
      );
      fatal = prorrogada;
    }
    memoria.push(
      `Data fatal: ${formatISODate(fatal)} (${diasEfetivos} dia(s) corrido(s)${dobro ? ", em dobro" : ""}).`,
    );
    return {
      dataDisponibilizacao: input.dataPublicacaoConhecida ? null : input.dataDisponibilizacao,
      dataPublicacao: formatISODate(dataPublicacao),
      dataInicioContagem: formatISODate(inicio),
      dataFatal: formatISODate(fatal),
      dias: input.dias,
      diasEfetivos,
      contagem,
      dobro,
      memoria,
    };
  }

  // 2. Início da contagem: primeiro dia útil seguinte à publicação (CPC art. 224 §3º)
  const inicio = cal.proximoDiaUtil(dataPublicacao);
  memoria.push(
    `Início da contagem = primeiro dia útil seguinte à publicação (CPC art. 224 §3º): ` +
      `${formatISODate(inicio)}.`,
  );

  // 3. Conta N dias úteis, contando o início como dia 1
  let d = inicio;
  let count = 1;
  while (count < diasEfetivos) {
    d = cal.proximoDiaUtil(d);
    count++;
  }
  const fatal = d;
  memoria.push(
    `Contados ${diasEfetivos} dia(s) útil(eis)${dobro ? " (em dobro)" : ""} (CPC art. 219). ` +
      `Data fatal: ${formatISODate(fatal)}.`,
  );

  return {
    dataDisponibilizacao: input.dataPublicacaoConhecida ? null : input.dataDisponibilizacao,
    dataPublicacao: formatISODate(dataPublicacao),
    dataInicioContagem: formatISODate(inicio),
    dataFatal: formatISODate(fatal),
    dias: input.dias,
    diasEfetivos,
    contagem,
    dobro,
    memoria,
  };
}
