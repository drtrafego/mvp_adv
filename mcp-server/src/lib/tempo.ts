import { addDays, formatISODate, parseISODate } from "./feriados.js";

/** Datas operacionais seguem o escritório; UTC só é usado na aritmética do calendário. */
export function hojeEscritorio(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: process.env.GABINETE_TIMEZONE ?? "America/Cuiaba",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function diasOperacionais(valor: string | number, maximo = 3650): number {
  const dias = Number(valor);
  if (!Number.isSafeInteger(dias) || dias < 1 || dias > maximo) {
    throw new Error(`Dias precisa ser um inteiro de 1 a ${maximo}.`);
  }
  return dias;
}

export function deslocarData(data: string, dias: number): string {
  return formatISODate(addDays(parseISODate(data), dias));
}
