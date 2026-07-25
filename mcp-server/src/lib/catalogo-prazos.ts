/**
 * Catálogo de atos processuais e seus prazos, por RITO.
 *
 * Por que existe: generalizar "15 dias úteis" para tudo é erro grave. Cada rito tem regra
 * própria de contagem. No processo penal a contagem é CORRIDA e não se suspende no recesso
 * (CPP art. 798). Na recuperação judicial e falência a contagem é CORRIDA (Lei 11.101 art. 189
 * §1º I, redação da Lei 14.112/2020). No processo do trabalho o recurso padrão é de 8 dias
 * (CLT), não 15. No Juizado Especial Cível o recurso inominado é de 10 dias. E quando a lei
 * silencia, o prazo residual é de 5 dias (CPC art. 218 §3º), NUNCA 15.
 *
 * Este catálogo é a fonte da classificação: a IA escolhe a CHAVE do ato, o código deriva dias,
 * contagem e regime de suspensão, e calcula a data. A IA não escolhe "quantos dias" no chute.
 *
 * Toda entrada traz o dispositivo e o link da fonte oficial. O que a pesquisa não conseguiu
 * fechar com segurança vem com `conferir` preenchido: nesses casos o sistema aplica a hipótese
 * MAIS CONSERVADORA (a que faz o prazo vencer mais cedo) e obriga o alerta ao advogado.
 */

export type Contagem = "uteis" | "corridos";

export type Rito =
  | "civel"
  | "penal"
  | "trabalhista"
  | "jec"
  | "recuperacao"
  | "fiscal"
  | "material";

export interface AtoPrazo {
  /** Identificador estável usado pela tool calcular_prazo. */
  chave: string;
  rotulo: string;
  rito: Rito;
  dias: number;
  contagem: Contagem;
  /** Artigo/parágrafo exato que fixa o prazo. */
  dispositivo: string;
  /** Link da fonte oficial (Planalto). */
  fonte: string;
  /**
   * Se o ato admite prazo em dobro. Falso onde a lei veda expressamente (Juizados: art. 9º da
   * Lei 10.259 e art. 7º da Lei 12.153 dizem que não há prazo diferenciado para o poder público).
   */
  dobroAdmitido: boolean;
  /**
   * Se a suspensão de 20/12 a 20/01 (CPC art. 220) incide. Falso no penal: o art. 798 do CPP
   * manda os prazos correrem contínuos, sem se interromper por férias, domingo ou feriado.
   */
  aplicaRecesso: boolean;
  /** Ponto de divergência ou incerteza. Preenchido = o sistema marca [CONFERIR] na saída. */
  conferir?: string;
  /** Termos que costumam aparecer na intimação, para ajudar a IA a reconhecer o ato. */
  sinonimos: string[];
}

const CPC = "http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm";
const CPP = "http://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm";
const CLT = "http://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm";
const L9099 = "http://www.planalto.gov.br/ccivil_03/leis/l9099.htm";
const L11101 = "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm";
const LEF = "http://www.planalto.gov.br/ccivil_03/leis/l6830.htm";
const LMS = "http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm";

export const CATALOGO_PRAZOS: AtoPrazo[] = [
  // -------------------------------------------------------------------------
  // CÍVEL (CPC, Lei 13.105/2015). Regra de contagem: dias úteis (art. 219),
  // aplicável somente a prazo PROCESSUAL (art. 219, parágrafo único).
  // -------------------------------------------------------------------------
  {
    chave: "contestacao",
    rotulo: "Contestação (procedimento comum)",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 335",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    conferir:
      "O termo inicial não é a citação em si: o art. 335 fixa marcos diferentes (audiência de " +
      "conciliação, protocolo do cancelamento, ou art. 231). Confirme qual inciso incide.",
    sinonimos: ["contestar", "apresentar defesa", "prazo para defesa", "resposta do réu"],
  },
  {
    chave: "replica",
    rotulo: "Réplica / impugnação à contestação",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 350 e art. 351",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["réplica", "impugnação à contestação", "manifestar sobre a contestação"],
  },
  {
    chave: "apelacao",
    rotulo: "Apelação (interposição)",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["apelar", "recurso de apelação", "apelação cível"],
  },
  {
    chave: "contrarrazoes-apelacao",
    rotulo: "Contrarrazões de apelação",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["contrarrazões de apelação", "responder à apelação"],
  },
  {
    chave: "agravo-instrumento",
    rotulo: "Agravo de instrumento",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["agravo de instrumento", "agravar da decisão interlocutória"],
  },
  {
    chave: "agravo-interno",
    rotulo: "Agravo interno",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.021 c/c art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["agravo interno", "agravo regimental"],
  },
  {
    chave: "contrarrazoes-agravo-interno",
    rotulo: "Contrarrazões de agravo interno",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.021 §2º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["manifestar sobre o agravo interno", "contrarrazões de agravo interno"],
  },
  {
    chave: "embargos-declaracao",
    rotulo: "Embargos de declaração (cível)",
    rito: "civel",
    dias: 5,
    contagem: "uteis",
    dispositivo: "CPC art. 1.023",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["embargos de declaração", "embargos declaratórios", "opor embargos"],
  },
  {
    chave: "contrarrazoes-embargos-declaracao",
    rotulo: "Contrarrazões / manifestação sobre embargos de declaração",
    rito: "civel",
    dias: 5,
    contagem: "uteis",
    dispositivo: "CPC art. 1.023 §2º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: [
      "contrarrazões de embargos de declaração",
      "manifestar sobre os embargos de declaração",
      "intimado sobre os embargos",
    ],
  },
  {
    chave: "recurso-especial",
    rotulo: "Recurso especial",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["recurso especial", "resp", "recurso ao STJ"],
  },
  {
    chave: "recurso-extraordinario",
    rotulo: "Recurso extraordinário",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["recurso extraordinário", "re", "recurso ao STF"],
  },
  {
    chave: "agravo-resp-re",
    rotulo: "Agravo em recurso especial / extraordinário",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.042 c/c art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["agravo em recurso especial", "aresp", "agravo em recurso extraordinário"],
  },
  {
    chave: "embargos-divergencia",
    rotulo: "Embargos de divergência",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 1.044 c/c art. 1.003 §5º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["embargos de divergência"],
  },
  {
    chave: "cumprimento-sentenca-pagamento",
    rotulo: "Cumprimento de sentença: pagamento voluntário",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 523",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    conferir:
      "Há tese (Enunciado 89 do FPPC) defendendo contagem em dias corridos por ser prazo de " +
      "natureza material. A posição majoritária é dias úteis. Confirme antes de contar com a " +
      "multa do §1º.",
    sinonimos: ["pagamento voluntário", "cumprimento de sentença", "intimado para pagar"],
  },
  {
    chave: "impugnacao-cumprimento",
    rotulo: "Impugnação ao cumprimento de sentença",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 525",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    conferir:
      "O termo inicial é o fim do prazo do art. 523, não uma nova intimação. Confirme a data " +
      "de encerramento do prazo de pagamento antes de contar.",
    sinonimos: ["impugnação ao cumprimento de sentença", "impugnar a execução"],
  },
  {
    chave: "embargos-execucao",
    rotulo: "Embargos à execução (título extrajudicial)",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 915",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["embargos à execução", "embargar a execução"],
  },
  {
    chave: "impugnacao-gratuidade",
    rotulo: "Impugnação à gratuidade de justiça",
    rito: "civel",
    dias: 15,
    contagem: "uteis",
    dispositivo: "CPC art. 100",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: ["impugnar a gratuidade", "impugnação à justiça gratuita"],
  },
  {
    chave: "manifestacao-generica",
    rotulo: "Manifestação sem prazo fixado em lei (prazo residual)",
    rito: "civel",
    dias: 5,
    contagem: "uteis",
    dispositivo: "CPC art. 218 §3º",
    fonte: CPC,
    dobroAdmitido: true,
    aplicaRecesso: true,
    sinonimos: [
      "prazo legal",
      "no prazo da lei",
      "manifeste-se",
      "diga sobre",
      "requeira o que entender de direito",
      "sob pena de preclusão",
    ],
  },

  // -------------------------------------------------------------------------
  // PENAL (CPP, Decreto-Lei 3.689/1941). Contagem CONTÍNUA: os prazos não se
  // interrompem por férias, domingo ou feriado (art. 798). Recesso não incide.
  // -------------------------------------------------------------------------
  {
    chave: "resposta-acusacao",
    rotulo: "Resposta à acusação (defesa criminal)",
    rito: "penal",
    dias: 10,
    contagem: "corridos",
    dispositivo: "CPP art. 396 e art. 396-A, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: [
      "resposta à acusação",
      "defesa criminal",
      "defesa prévia",
      "responder à acusação",
    ],
  },
  {
    chave: "apelacao-penal-interposicao",
    rotulo: "Apelação criminal (interposição)",
    rito: "penal",
    dias: 5,
    contagem: "corridos",
    dispositivo: "CPP art. 593, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["apelação criminal", "interpor apelação criminal", "apelar da sentença penal"],
  },
  {
    chave: "apelacao-penal-razoes",
    rotulo: "Razões / contrarrazões de apelação criminal",
    rito: "penal",
    dias: 8,
    contagem: "corridos",
    dispositivo: "CPP art. 600, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["razões de apelação criminal", "contrarrazões de apelação criminal"],
  },
  {
    chave: "apelacao-penal-razoes-contravencao",
    rotulo: "Razões de apelação criminal em contravenção",
    rito: "penal",
    dias: 3,
    contagem: "corridos",
    dispositivo: "CPP art. 600, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["razões de apelação em contravenção", "processo de contravenção penal"],
  },
  {
    chave: "rese-interposicao",
    rotulo: "Recurso em sentido estrito (interposição)",
    rito: "penal",
    dias: 5,
    contagem: "corridos",
    dispositivo: "CPP art. 586, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "Na hipótese do art. 581, XIV o prazo é de 20 dias (art. 586, parágrafo único). Confirme " +
      "qual inciso do art. 581 é o caso.",
    sinonimos: ["recurso em sentido estrito", "rese"],
  },
  {
    chave: "rese-razoes",
    rotulo: "Razões / contrarrazões de recurso em sentido estrito",
    rito: "penal",
    dias: 2,
    contagem: "corridos",
    dispositivo: "CPP art. 588, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["razões do rese", "contrarrazões do recurso em sentido estrito"],
  },
  {
    chave: "embargos-declaracao-penal",
    rotulo: "Embargos de declaração (penal)",
    rito: "penal",
    dias: 2,
    contagem: "corridos",
    dispositivo: "CPP art. 619, c/c art. 798",
    fonte: CPP,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["embargos de declaração criminal", "embargos declaratórios no penal"],
  },

  // -------------------------------------------------------------------------
  // TRABALHISTA (CLT). Contagem em dias úteis desde a Lei 13.467/2017 (art. 775).
  // O recurso padrão é de 8 dias, não 15.
  // -------------------------------------------------------------------------
  {
    chave: "recurso-ordinario",
    rotulo: "Recurso ordinário",
    rito: "trabalhista",
    dias: 8,
    contagem: "uteis",
    dispositivo: "CLT art. 895, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    conferir:
      "A suspensão do art. 220 do CPC é do processo civil; a Justiça do Trabalho tem regime " +
      "próprio. O sistema não aplica o recesso aqui. Confirme o calendário do TRT.",
    sinonimos: ["recurso ordinário", "ro trabalhista"],
  },
  {
    chave: "recurso-revista",
    rotulo: "Recurso de revista",
    rito: "trabalhista",
    dias: 8,
    contagem: "uteis",
    dispositivo: "CLT art. 896, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    sinonimos: ["recurso de revista", "rr"],
  },
  {
    chave: "agravo-peticao",
    rotulo: "Agravo de petição",
    rito: "trabalhista",
    dias: 8,
    contagem: "uteis",
    dispositivo: "CLT art. 897, a, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    sinonimos: ["agravo de petição"],
  },
  {
    chave: "agravo-instrumento-trabalhista",
    rotulo: "Agravo de instrumento (trabalhista)",
    rito: "trabalhista",
    dias: 8,
    contagem: "uteis",
    dispositivo: "CLT art. 897, b, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    sinonimos: ["agravo de instrumento trabalhista"],
  },
  {
    chave: "embargos-tst",
    rotulo: "Embargos ao TST (SDI)",
    rito: "trabalhista",
    dias: 8,
    contagem: "uteis",
    dispositivo: "CLT art. 894, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    sinonimos: ["embargos ao TST", "embargos à SDI"],
  },
  {
    chave: "embargos-declaracao-trabalhista",
    rotulo: "Embargos de declaração (trabalhista)",
    rito: "trabalhista",
    dias: 5,
    contagem: "uteis",
    dispositivo: "CLT art. 897-A, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    sinonimos: ["embargos de declaração trabalhista"],
  },
  {
    chave: "contrarrazoes-trabalhista",
    rotulo: "Contrarrazões (recurso trabalhista)",
    rito: "trabalhista",
    dias: 8,
    contagem: "uteis",
    dispositivo: "CLT art. 900, c/c art. 775",
    fonte: CLT,
    dobroAdmitido: true,
    aplicaRecesso: false,
    conferir:
      "O art. 900 dá ao recorrido prazo IGUAL ao do recorrente. Se o recurso tiver prazo " +
      "diferente de 8 dias, ajuste os dias manualmente.",
    sinonimos: ["contrarrazões trabalhistas", "responder ao recurso ordinário"],
  },

  // -------------------------------------------------------------------------
  // JUIZADO ESPECIAL CÍVEL (Lei 9.099/1995). Dias úteis desde o art. 12-A
  // (incluído pela Lei 13.728/2018). Não há prazo diferenciado para o poder
  // público no JEF (Lei 10.259 art. 9º) nem no Juizado da Fazenda (Lei 12.153 art. 7º).
  // -------------------------------------------------------------------------
  {
    chave: "recurso-inominado",
    rotulo: "Recurso inominado (JEC)",
    rito: "jec",
    dias: 10,
    contagem: "uteis",
    dispositivo: "Lei 9.099/95 art. 42, c/c art. 12-A",
    fonte: L9099,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "A incidência da suspensão do art. 220 do CPC no Juizado não está confirmada; o sistema " +
      "não aplica o recesso aqui (hipótese conservadora). Confirme no enunciado da Turma Recursal.",
    sinonimos: ["recurso inominado", "recurso do juizado"],
  },
  {
    chave: "contrarrazoes-recurso-inominado",
    rotulo: "Contrarrazões de recurso inominado (JEC)",
    rito: "jec",
    dias: 10,
    contagem: "uteis",
    dispositivo: "Lei 9.099/95 art. 42 §2º, c/c art. 12-A",
    fonte: L9099,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["contrarrazões de recurso inominado", "resposta ao recurso inominado"],
  },
  {
    chave: "embargos-declaracao-jec",
    rotulo: "Embargos de declaração (JEC)",
    rito: "jec",
    dias: 5,
    contagem: "uteis",
    dispositivo: "Lei 9.099/95 art. 49, c/c art. 12-A",
    fonte: L9099,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "No JEC os embargos INTERROMPEM o prazo do recurso (art. 50, redação da Lei 13.105/2015): " +
      "o prazo recomeça do zero, não retoma de onde parou.",
    sinonimos: ["embargos de declaração no juizado"],
  },

  // -------------------------------------------------------------------------
  // RECUPERAÇÃO JUDICIAL E FALÊNCIA (Lei 11.101/2005). Contagem em dias
  // CORRIDOS por força do art. 189 §1º I (redação da Lei 14.112/2020).
  // -------------------------------------------------------------------------
  {
    chave: "habilitacao-credito",
    rotulo: "Habilitação de crédito / divergência",
    rito: "recuperacao",
    dias: 15,
    contagem: "corridos",
    dispositivo: "Lei 11.101/05 art. 7º §1º, c/c art. 189 §1º I",
    fonte: L11101,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["habilitação de crédito", "divergência de crédito", "habilitar crédito"],
  },
  {
    chave: "impugnacao-relacao-credores",
    rotulo: "Impugnação à relação de credores",
    rito: "recuperacao",
    dias: 10,
    contagem: "corridos",
    dispositivo: "Lei 11.101/05 art. 8º, c/c art. 189 §1º I",
    fonte: L11101,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["impugnação à relação de credores", "impugnar o quadro geral de credores"],
  },
  {
    chave: "plano-recuperacao",
    rotulo: "Apresentação do plano de recuperação",
    rito: "recuperacao",
    dias: 60,
    contagem: "corridos",
    dispositivo: "Lei 11.101/05 art. 53, c/c art. 189 §1º I",
    fonte: L11101,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "Prazo IMPRORROGÁVEL, sob pena de convolação em falência. O termo inicial é a publicação " +
      "da decisão que defere o processamento, não a intimação do advogado.",
    sinonimos: ["plano de recuperação judicial", "apresentar o plano"],
  },
  {
    chave: "objecao-plano",
    rotulo: "Objeção ao plano de recuperação",
    rito: "recuperacao",
    dias: 30,
    contagem: "corridos",
    dispositivo: "Lei 11.101/05 art. 55, c/c art. 189 §1º I",
    fonte: L11101,
    dobroAdmitido: false,
    aplicaRecesso: false,
    sinonimos: ["objeção ao plano", "objetar o plano de recuperação"],
  },
  {
    chave: "agravo-recuperacao",
    rotulo: "Agravo de instrumento em recuperação / falência",
    rito: "recuperacao",
    dias: 15,
    contagem: "corridos",
    dispositivo: "Lei 11.101/05 art. 189 §1º I (contagem) c/c CPC art. 1.003 §5º (prazo)",
    fonte: L11101,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "DIVERGÊNCIA REAL: discute-se se o recurso, regido supletivamente pelo CPC, conta em dias " +
      "úteis, ou se a expressão 'ou que dela decorram' do art. 189 §1º I impõe dias corridos. O " +
      "sistema adota CORRIDOS (hipótese que vence antes, mais segura). Confirme antes de usar " +
      "o prazo maior.",
    sinonimos: ["agravo em recuperação judicial", "agravo na falência"],
  },

  // -------------------------------------------------------------------------
  // EXECUÇÃO FISCAL (Lei 6.830/1980).
  // -------------------------------------------------------------------------
  {
    chave: "embargos-execucao-fiscal",
    rotulo: "Embargos à execução fiscal",
    rito: "fiscal",
    dias: 30,
    contagem: "uteis",
    dispositivo: "Lei 6.830/80 art. 16",
    fonte: LEF,
    dobroAdmitido: true,
    aplicaRecesso: true,
    conferir:
      "DIVERGÊNCIA: o Enunciado 20 da I Jornada de Direito Processual Civil do CJF aplica o art. " +
      "219 do CPC (dias úteis), posição dominante. Há tese de especialidade defendendo dias " +
      "corridos. O termo inicial também varia (depósito, fiança/seguro, intimação da penhora).",
    sinonimos: ["embargos à execução fiscal", "embargar a execução fiscal"],
  },

  // -------------------------------------------------------------------------
  // MANDADO DE SEGURANÇA (Lei 12.016/2009).
  // -------------------------------------------------------------------------
  {
    chave: "ms-impetracao",
    rotulo: "Impetração de mandado de segurança (decadencial)",
    rito: "material",
    dias: 120,
    contagem: "corridos",
    dispositivo: "Lei 12.016/09 art. 23",
    fonte: LMS,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "Prazo de DIREITO MATERIAL (decadência), fora da regra do art. 219 do CPC. O termo inicial " +
      "é a ciência do ato impugnado pelo interessado, não a publicação no diário. Informe a data " +
      "de ciência em data_publicacao_conhecida.",
    sinonimos: ["prazo para impetrar mandado de segurança", "decadência do mandado de segurança"],
  },
  {
    chave: "acao-rescisoria",
    rotulo: "Ajuizamento de ação rescisória (decadencial)",
    rito: "material",
    dias: 730,
    contagem: "corridos",
    dispositivo: "CPC art. 975",
    fonte: CPC,
    dobroAdmitido: false,
    aplicaRecesso: false,
    conferir:
      "Prazo de DIREITO MATERIAL (decadência de 2 anos). O termo inicial é o trânsito em julgado " +
      "da última decisão proferida no processo, não a intimação. Informe essa data em " +
      "data_publicacao_conhecida e confira as hipóteses dos §§ do art. 975.",
    sinonimos: ["ação rescisória", "prazo para rescisória", "decadência da rescisória"],
  },
  {
    chave: "ms-informacoes",
    rotulo: "Informações da autoridade coatora (MS)",
    rito: "civel",
    dias: 10,
    contagem: "uteis",
    dispositivo: "Lei 12.016/09 art. 7º I",
    fonte: LMS,
    dobroAdmitido: false,
    aplicaRecesso: true,
    sinonimos: ["informações da autoridade coatora", "prestar informações no mandado de segurança"],
  },
];

const PORCHAVE = new Map(CATALOGO_PRAZOS.map((a) => [a.chave, a]));

/** Chaves válidas, na ordem do catálogo. Usado para montar o enum da tool. */
export const CHAVES_ATO = CATALOGO_PRAZOS.map((a) => a.chave) as [string, ...string[]];

export function buscarAto(chave: string): AtoPrazo | undefined {
  return PORCHAVE.get(chave);
}

/**
 * Ato usado quando a intimação não identifica prazo específico e a lei silencia.
 * É 5 dias (CPC art. 218 §3º), NÃO 15. Este é o fallback correto do sistema.
 */
export const ATO_RESIDUAL = "manifestacao-generica";

/** Rótulo legível do rito, para a memória de cálculo. */
export const ROTULO_RITO: Record<Rito, string> = {
  civel: "cível (CPC)",
  penal: "penal (CPP)",
  trabalhista: "trabalhista (CLT)",
  jec: "juizado especial (Lei 9.099)",
  recuperacao: "recuperação judicial / falência (Lei 11.101)",
  fiscal: "execução fiscal (Lei 6.830)",
  material: "prazo de direito material (decadencial/prescricional)",
};
