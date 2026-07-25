/**
 * Motor determinístico de prazos processuais.
 *
 * Princípio do Gabinete: a IA classifica o ATO (qual chave do catálogo, se em dobro), o CÓDIGO
 * calcula a data fatal. Nenhum campo crítico sai de LLM. Aqui é só aritmética de calendário.
 *
 * O que muda em relação à versão que generalizava 15 dias: os dias e o regime de contagem não
 * vêm mais do palpite da IA. Vêm do catálogo por rito (catalogo-prazos.ts), porque cada rito
 * tem regra própria:
 * - Cível (CPC art. 219): dias ÚTEIS, com suspensão de 20/12 a 20/01 (art. 220).
 * - Penal (CPP art. 798): dias CORRIDOS e contínuos, SEM suspensão por férias ou feriado.
 * - Trabalhista (CLT art. 775): dias ÚTEIS, recurso padrão de 8 dias.
 * - Juizado Especial Cível (Lei 9.099 art. 12-A): dias ÚTEIS, recurso inominado de 10 dias.
 * - Recuperação e falência (Lei 11.101 art. 189 §1º I): dias CORRIDOS.
 * - Prazo material/decadencial: fora do art. 219, conta corrido da ciência do ato.
 *
 * Outras regras aplicadas:
 * - Lei 11.419/2006, art. 4º, §3º: publicação = primeiro dia útil seguinte à disponibilização.
 * - Lei 11.419/2006, art. 4º, §4º + CPC art. 224, §3º: a contagem começa no primeiro dia útil
 *   seguinte à data de publicação (exclui-se o dia do começo, inclui-se o do vencimento).
 * - Prazo em dobro: dias x 2 (Fazenda art. 183, MP art. 180, Defensoria art. 186, litisconsortes
 *   com procuradores distintos em autos FÍSICOS art. 229). Não se aplica onde a lei veda.
 */

import {
  addDays,
  criarCalendario,
  ehRecessoForense,
  formatISODate,
  parseISODate,
  type CalendarioOptions,
} from "./feriados.js";
import {
  buscarAto,
  ROTULO_RITO,
  type AtoPrazo,
  type Contagem,
  type Rito,
} from "./catalogo-prazos.js";

export type { Contagem };

export interface CalcularPrazoInput {
  /** Data de disponibilização no DJEN, 'YYYY-MM-DD' (o que a Comunica retorna). */
  dataDisponibilizacao: string;
  /**
   * Chave do ato no catálogo (ex.: 'resposta-acusacao', 'recurso-ordinario'). Quando informada,
   * define dias, contagem, rito e regime de suspensão. É o caminho correto: a IA classifica o
   * ato, não inventa o número de dias.
   */
  atoChave?: string;
  /**
   * Número de dias do prazo (antes de eventual dobro). Só para o caso em que o ato não está no
   * catálogo, ou quando o juiz fixou prazo diferente do legal. Sobrepõe o catálogo.
   */
  dias?: number;
  /** Sobrepõe a contagem do catálogo. Use apenas com justificativa. */
  contagem?: Contagem;
  /** Aplica prazo em dobro. Ignorado (com alerta) nos ritos em que a lei veda. */
  dobro?: boolean;
  /**
   * Se a publicação já é conhecida (ex.: ciência pessoal em audiência), informar aqui e
   * pular a etapa de disponibilização→publicação. Formato 'YYYY-MM-DD'. Em prazo material é
   * a data da CIÊNCIA do ato, e é obrigatória.
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
  /** Ato do catálogo aplicado, quando houve. */
  ato: string | null;
  rito: Rito | null;
  dispositivo: string | null;
  fonte: string | null;
  /** Passo a passo legível, para auditoria e para o painel mostrar a justificativa. */
  memoria: string[];
  /** Pontos que o advogado precisa conferir antes de agir. Vazio = nada pendente. */
  alertas: string[];
}

/**
 * Calcula a data fatal de um prazo processual de forma determinística.
 */
export function calcularPrazo(input: CalcularPrazoInput): CalcularPrazoResult {
  const memoria: string[] = [];
  const alertas: string[] = [];

  // 0. Resolve o ato no catálogo e deriva os parâmetros.
  let ato: AtoPrazo | undefined;
  if (input.atoChave) {
    ato = buscarAto(input.atoChave);
    if (!ato) {
      throw new Error(
        `Ato '${input.atoChave}' não existe no catálogo de prazos. Use uma chave válida ou ` +
          `informe 'dias' e 'contagem' manualmente com justificativa.`,
      );
    }
  }

  const dias = input.dias ?? ato?.dias;
  if (dias === undefined) {
    throw new Error(
      "Informe o ato (atoChave) ou o número de dias. Quando a intimação não identifica o ato e a " +
        "lei silencia, o prazo é de 5 dias (CPC art. 218 §3º): use a chave 'manifestacao-generica'.",
    );
  }

  const contagem: Contagem = input.contagem ?? ato?.contagem ?? "uteis";
  const rito: Rito | null = ato?.rito ?? null;

  if (ato) {
    memoria.push(
      `Ato: ${ato.rotulo}. Rito: ${ROTULO_RITO[ato.rito]}. Prazo legal: ${ato.dias} dia(s) ` +
        `${ato.contagem === "uteis" ? "úteis" : "corridos"} (${ato.dispositivo}).`,
    );
    if (ato.conferir) alertas.push(`[CONFERIR] ${ato.rotulo}: ${ato.conferir}`);
    if (input.dias !== undefined && input.dias !== ato.dias) {
      memoria.push(
        `Dias sobrepostos manualmente: ${input.dias} no lugar de ${ato.dias} do catálogo.`,
      );
      alertas.push(
        `[CONFERIR] O prazo usado (${input.dias} dias) diverge do prazo legal do ato ` +
          `(${ato.dias} dias, ${ato.dispositivo}). Confirme se o juiz fixou prazo diverso.`,
      );
    }
    if (input.contagem && input.contagem !== ato.contagem) {
      alertas.push(
        `[CONFERIR] A contagem usada (${input.contagem}) diverge da do rito ` +
          `(${ato.contagem}, ${ato.dispositivo}). Confirme antes de usar.`,
      );
    }
  } else {
    memoria.push(
      `Ato fora do catálogo: ${dias} dia(s) ${contagem === "uteis" ? "úteis" : "corridos"} ` +
        `informados manualmente.`,
    );
    alertas.push(
      "[CONFERIR] O prazo não veio do catálogo por rito: dias, contagem e admissão de dobro " +
        "foram informados manualmente e não estão amarrados a um dispositivo legal. Confirme se " +
        "o rito conta em dias úteis ou corridos e se este ato admite prazo em dobro.",
    );
  }

  // Prazo em dobro: só onde a lei admite.
  let dobro = input.dobro ?? false;
  if (dobro && ato && !ato.dobroAdmitido) {
    dobro = false;
    alertas.push(
      `[CONFERIR] Prazo em dobro NÃO aplicado: a lei não admite prazo diferenciado neste ato ` +
        `(${ato.rotulo}). Nos Juizados não há prazo diferenciado para o poder público ` +
        `(Lei 10.259 art. 9º; Lei 12.153 art. 7º); no processo penal a prerrogativa é da ` +
        `Defensoria por lei própria, não do art. 229 do CPC.`,
    );
  }
  if (dobro) {
    alertas.push(
      "[CONFERIR] Prazo em dobro aplicado. Ele NÃO vale quando a lei fixa prazo próprio para o " +
        "ente (CPC arts. 180 §2º, 183 §2º, 186 §4º), nem por litisconsórcio em autos " +
        "ELETRÔNICOS (CPC art. 229 §2º).",
    );
  }

  const diasEfetivos = dobro ? dias * 2 : dias;
  if (diasEfetivos <= 0) {
    throw new Error("O prazo precisa ter ao menos 1 dia.");
  }

  // Regime de suspensão: o recesso do art. 220 não incide no penal (CPP art. 798) nem nos
  // ritos em que o catálogo marca aplicaRecesso = false.
  const aplicarRecesso = input.calendario?.aplicarRecesso ?? ato?.aplicaRecesso ?? true;
  const cal = criarCalendario({ ...input.calendario, aplicarRecesso });
  if (ato && !ato.aplicaRecesso) {
    memoria.push(
      rito === "penal"
        ? "Suspensão de 20/12 a 20/01 NÃO aplicada: no processo penal os prazos são contínuos e " +
          "não se interrompem por férias, domingo ou feriado (CPP art. 798)."
        : "Suspensão de 20/12 a 20/01 NÃO aplicada neste rito (hipótese conservadora: a data " +
          "fatal vem antes). Confira o calendário do tribunal.",
    );
  }

  // Prazo material (decadencial/prescricional): o termo inicial é a CIÊNCIA do ato, não a
  // publicação no diário. Sem essa data o cálculo não tem sentido.
  if (rito === "material") {
    if (!input.dataPublicacaoConhecida) {
      throw new Error(
        "Prazo de direito material (decadencial): informe a data da CIÊNCIA do ato em " +
          "dataPublicacaoConhecida. Ele não corre da publicação no diário.",
      );
    }
    alertas.push(
      "[CONFERIR] Prazo de DIREITO MATERIAL, fora da regra do art. 219 do CPC: conta em dias " +
        "corridos, não se suspende no recesso e a perda é definitiva (decadência).",
    );
  }

  // 1. Data de publicação
  let dataPublicacao: Date;
  if (input.dataPublicacaoConhecida) {
    dataPublicacao = parseISODate(input.dataPublicacaoConhecida);
    memoria.push(
      rito === "material"
        ? `Ciência do ato em ${formatISODate(dataPublicacao)}.`
        : `Publicação informada diretamente: ${formatISODate(dataPublicacao)}.`,
    );
  } else {
    const disp = parseISODate(input.dataDisponibilizacao);
    dataPublicacao = cal.proximoDiaUtil(disp);
    memoria.push(
      `Disponibilização em ${formatISODate(disp)}. Publicação = primeiro dia útil seguinte ` +
        `(Lei 11.419/06 art. 4º §3º): ${formatISODate(dataPublicacao)}.`,
    );
  }

  if (contagem === "corridos") {
    // Dias corridos: sábado, domingo e feriado CONTAM. Duas ressalvas:
    // - a suspensão do art. 220, quando incide neste rito, pausa o curso do prazo (os dias entre
    //   20/12 e 20/01 não entram na conta); por isso a contagem é dia a dia, não um salto único;
    // - se o vencimento cair em dia sem expediente, prorroga (CPC art. 224 §1º; no penal,
    //   CPP art. 798 §3º).
    let inicio = addDays(dataPublicacao, 1);
    if (aplicarRecesso && ehRecessoForense(inicio)) {
      while (ehRecessoForense(inicio)) inicio = addDays(inicio, 1);
      memoria.push(
        `Início recai na suspensão de 20/12 a 20/01 (CPC art. 220); a contagem só começa em ` +
          `${formatISODate(inicio)}.`,
      );
    }
    memoria.push(
      `Contagem em dias CORRIDOS a partir de ${formatISODate(inicio)} ` +
        `(exclui-se o dia do começo, inclui-se o do vencimento).`,
    );
    let fatal = inicio;
    let corridos = 1;
    let suspensos = 0;
    while (corridos < diasEfetivos) {
      fatal = addDays(fatal, 1);
      if (aplicarRecesso && ehRecessoForense(fatal)) {
        suspensos++;
        continue;
      }
      corridos++;
    }
    if (suspensos > 0) {
      memoria.push(
        `${suspensos} dia(s) não contados por recaírem na suspensão de 20/12 a 20/01 ` +
          `(CPC art. 220).`,
      );
    }
    if (!cal.ehDiaUtil(fatal)) {
      const prorrogada = cal.diaUtilOuProximo(fatal);
      memoria.push(
        `Vencimento em ${formatISODate(fatal)} cai em dia sem expediente; prorroga para ` +
          `${formatISODate(prorrogada)} (${rito === "penal" ? "CPP art. 798 §3º" : "CPC art. 224 §1º"}).`,
      );
      fatal = prorrogada;
      if (rito === "material") {
        alertas.push(
          "[CONFERIR] O vencimento do prazo material foi prorrogado por cair em dia sem " +
            "expediente. A prorrogação de prazo decadencial não é pacífica; não conte com ela.",
        );
      }
    }
    memoria.push(
      `Data fatal: ${formatISODate(fatal)} (${diasEfetivos} dia(s) corrido(s)${dobro ? ", em dobro" : ""}).`,
    );
    return {
      dataDisponibilizacao: input.dataPublicacaoConhecida ? null : input.dataDisponibilizacao,
      dataPublicacao: formatISODate(dataPublicacao),
      dataInicioContagem: formatISODate(inicio),
      dataFatal: formatISODate(fatal),
      dias,
      diasEfetivos,
      contagem,
      dobro,
      ato: ato?.chave ?? null,
      rito,
      dispositivo: ato?.dispositivo ?? null,
      fonte: ato?.fonte ?? null,
      memoria,
      alertas,
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
    `Contados ${diasEfetivos} dia(s) útil(eis)${dobro ? " (em dobro)" : ""} ` +
      `(${rito === "trabalhista" ? "CLT art. 775" : rito === "jec" ? "Lei 9.099 art. 12-A" : "CPC art. 219"}). ` +
      `Data fatal: ${formatISODate(fatal)}.`,
  );

  return {
    dataDisponibilizacao: input.dataPublicacaoConhecida ? null : input.dataDisponibilizacao,
    dataPublicacao: formatISODate(dataPublicacao),
    dataInicioContagem: formatISODate(inicio),
    dataFatal: formatISODate(fatal),
    dias,
    diasEfetivos,
    contagem,
    dobro,
    ato: ato?.chave ?? null,
    rito,
    dispositivo: ato?.dispositivo ?? null,
    fonte: ato?.fonte ?? null,
    memoria,
    alertas,
  };
}
