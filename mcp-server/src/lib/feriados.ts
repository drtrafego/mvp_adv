/**
 * Cálculo de feriados e dias úteis para contagem de prazos processuais.
 *
 * Fontes legais:
 * - Feriados nacionais fixos: Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023 (Consciência Negra).
 * - Feriados forenses móveis (Carnaval, Sexta-feira Santa, Corpus Christi): não são feriados
 *   nacionais por lei federal, mas há SUSPENSÃO de expediente forense na maioria dos tribunais
 *   por ato próprio. Como não há expediente, o prazo não corre. Tratamos como não-úteis por
 *   padrão e marcamos para conferência (cada tribunal confirma no seu calendário).
 * - Recesso / suspensão de prazos 20/12 a 20/01: CPC art. 220.
 *
 * Trabalhamos sempre com datas em UTC (meia-noite) para evitar problemas de fuso.
 */

/** Cria um Date em UTC a partir de 'YYYY-MM-DD'. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formata um Date UTC como 'YYYY-MM-DD'. */
export function formatISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Retorna uma nova data somando `days` dias (UTC). */
export function addDays(date: Date, days: number): Date {
  const r = new Date(date.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function mmdd(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${m}-${d}`;
}

/** Domingo de Páscoa (algoritmo de Meeus/Gauss) como Date UTC do ano informado. */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Feriados nacionais FIXOS (mm-dd) reconhecidos por lei federal. */
const FERIADOS_FIXOS = new Set([
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra (Lei 14.759/2023, nacional desde 2024)
  "12-25", // Natal
]);

export type FeriadoMovel = { data: Date; nome: string; forense: boolean };

/**
 * Feriados/suspensões móveis do ano (dependem da Páscoa).
 * `forense: true` = suspensão forense típica, não feriado nacional por lei — marcar [CONFERIR].
 */
export function feriadosMoveis(ano: number): FeriadoMovel[] {
  const p = pascoa(ano);
  return [
    { data: addDays(p, -48), nome: "Carnaval (segunda)", forense: true },
    { data: addDays(p, -47), nome: "Carnaval (terça)", forense: true },
    { data: addDays(p, -46), nome: "Quarta-feira de Cinzas", forense: true },
    { data: addDays(p, -2), nome: "Sexta-feira Santa", forense: false }, // feriado religioso amplamente reconhecido
    { data: addDays(p, 60), nome: "Corpus Christi", forense: true },
  ];
}

/**
 * True se a data cai dentro do recesso/suspensão de prazos do CPC art. 220
 * (20/12 a 20/01, inclusive). Nesse período o prazo não corre.
 */
export function ehRecessoForense(date: Date): boolean {
  const mes = date.getUTCMonth() + 1;
  const dia = date.getUTCDate();
  if (mes === 12 && dia >= 20) return true;
  if (mes === 1 && dia <= 20) return true;
  return false;
}

export interface CalendarioOptions {
  /** Datas de feriados forenses/suspensões locais por tribunal, em 'YYYY-MM-DD'. */
  feriadosForenses?: string[];
  /** Considerar feriados forenses móveis (Carnaval, Corpus Christi) como não-úteis. Padrão: true. */
  incluirForensesMoveis?: boolean;
  /**
   * Aplicar a suspensão de 20/12 a 20/01 (CPC art. 220). Padrão: true.
   *
   * Falso no processo penal: o art. 798 do CPP manda os prazos correrem contínuos, sem se
   * interromper por férias, domingo ou feriado. Aplicar o recesso ali empurraria a data fatal
   * para depois de 20/01 e o prazo já teria vencido.
   */
  aplicarRecesso?: boolean;
}

/**
 * Constrói um verificador de dia útil para uso na contagem.
 * Um dia é útil quando não é sábado, domingo, feriado nacional, forense móvel,
 * feriado forense local, nem recesso do art. 220 (quando este se aplica).
 */
export function criarCalendario(opts: CalendarioOptions = {}) {
  const incluirForensesMoveis = opts.incluirForensesMoveis ?? true;
  const aplicarRecesso = opts.aplicarRecesso ?? true;
  const forensesLocais = new Set(opts.feriadosForenses ?? []);

  // cache de feriados móveis por ano
  const moveisPorAno = new Map<number, Set<string>>();
  function moveisDoAno(ano: number): Set<string> {
    let s = moveisPorAno.get(ano);
    if (!s) {
      s = new Set(
        feriadosMoveis(ano)
          .filter((f) => (f.forense ? incluirForensesMoveis : true))
          .map((f) => formatISODate(f.data)),
      );
      moveisPorAno.set(ano, s);
    }
    return s;
  }

  function ehDiaUtil(date: Date): boolean {
    const dow = date.getUTCDay(); // 0 domingo, 6 sábado
    if (dow === 0 || dow === 6) return false;
    if (FERIADOS_FIXOS.has(mmdd(date))) return false;
    if (aplicarRecesso && ehRecessoForense(date)) return false;
    if (moveisDoAno(date.getUTCFullYear()).has(formatISODate(date))) return false;
    if (forensesLocais.has(formatISODate(date))) return false;
    return true;
  }

  /** Menor dia útil estritamente maior que `date`. */
  function proximoDiaUtil(date: Date): Date {
    let d = addDays(date, 1);
    while (!ehDiaUtil(d)) d = addDays(d, 1);
    return d;
  }

  /** `date` se já for útil; senão o próximo dia útil. */
  function diaUtilOuProximo(date: Date): Date {
    let d = new Date(date.getTime());
    while (!ehDiaUtil(d)) d = addDays(d, 1);
    return d;
  }

  return { ehDiaUtil, proximoDiaUtil, diaUtilOuProximo };
}

export type Calendario = ReturnType<typeof criarCalendario>;
