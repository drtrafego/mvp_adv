/**
 * Cliente da Comunica API / DJEN (CNJ) — fonte oficial das intimações e prazos.
 *
 * Consulta pública por OAB: GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
 * Sem autenticação (a consulta é pública). Filtra por OAB, UF, datas, tribunal, processo.
 *
 * GOTCHA (verificado): chamadas de servidor/datacenter sem navegador podem tomar 403 do
 * Cloudflare. No modelo "sob comando" (rodando na máquina do advogado) costuma passar.
 * Este cliente manda headers de navegador e faz retry; se persistir 403, devolve erro claro
 * orientando os fallbacks (navegador headless, intermediário pago, redundância por e-mail).
 */

import { ehDoAdvogado, parseOab, type IdentidadeOab } from "./oab.js";

const BASE = "https://comunicaapi.pje.jus.br/api/v1";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Referer: "https://comunica.pje.jus.br/",
  Origin: "https://comunica.pje.jus.br",
};

export interface ComunicacaoDJEN {
  hash: string | null;
  numeroProcesso: string | null;
  siglaTribunal: string | null;
  tipoComunicacao: string | null;
  nomeOrgao: string | null;
  texto: string;
  dataDisponibilizacao: string | null;
  meio: string | null;
  link: string | null;
  destinatarios: string[];
  advogados: Array<{ nome: string; oab: string | null }>;
}

export interface BuscarIntimacoesParams {
  numeroOab: string;
  ufOab: string;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  siglaTribunal?: string;
  numeroProcesso?: string;
  pagina?: number;
  itensPorPagina?: number;
  /**
   * Letra da OAB (o "B" de 11.158-B). NÃO é detalhe cosmético: a API do DJEN trata
   * "11158" e "11158-B" como inscrições DIFERENTES, e devolve conjuntos diferentes.
   * Medido na carteira do escritório em 26/07/2026: "11158" devolve 14 comunicações (só
   * tribunais federais) e "11158-B" devolve 849 (as do TJMT). Consultar só os dígitos
   * escondia praticamente todas as intimações estaduais.
   */
  letraOab?: string | null;
  /**
   * Identidades do advogado (número + UF). Se informado, filtra o resultado mantendo só as
   * comunicações que têm algum advogado destinatário batendo por número+UF (junta os vários
   * formatos da mesma OAB e corta homônimos).
   */
  oabsAlvo?: IdentidadeOab[];
}

export class ComunicaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bloqueadoPorWAF = false,
  ) {
    super(message);
    this.name = "ComunicaError";
  }
}

export interface ComunicaRawItem {
  hash?: string;
  numeroprocessocommascara?: string;
  numero_processo?: string;
  siglaTribunal?: string;
  nomeOrgao?: string;
  tipoComunicacao?: string;
  texto?: string;
  data_disponibilizacao?: string;
  meiocompleto?: string;
  meio?: string;
  link?: string;
  destinatarios?: Array<{ nome?: string }>;
  destinatarioadvogados?: Array<{ advogado?: { nome?: string; numero_oab?: string; uf_oab?: string } }>;
}

/** Base pública da Comunica API (mesma origem usada pelo SPA). */
export const COMUNICA_API_BASE = BASE;

/**
 * Monta a URL da consulta na Comunica API a partir dos parâmetros.
 * Reaproveitada pelo caminho de navegador (fetch same-origin dentro do SPA).
 */
export function montarUrlComunica(params: BuscarIntimacoesParams): string {
  const qs = new URLSearchParams();
  qs.set("numeroOab", params.numeroOab);
  qs.set("ufOab", params.ufOab.toUpperCase());
  if (params.dataInicio) qs.set("dataDisponibilizacaoInicio", params.dataInicio);
  if (params.dataFim) qs.set("dataDisponibilizacaoFim", params.dataFim);
  if (params.siglaTribunal) qs.set("siglaTribunal", params.siglaTribunal.toUpperCase());
  if (params.numeroProcesso) qs.set("numeroProcesso", params.numeroProcesso);
  qs.set("pagina", String(params.pagina ?? 1));
  qs.set("itensPorPagina", String(params.itensPorPagina ?? 100));
  return `${BASE}/comunicacao?${qs.toString()}`;
}

export function normalizar(item: ComunicaRawItem): ComunicacaoDJEN {
  const advogados = (item.destinatarioadvogados ?? []).map((d) => ({
    nome: d.advogado?.nome ?? "",
    oab: d.advogado?.numero_oab
      ? `${d.advogado.numero_oab}${d.advogado.uf_oab ? "/" + d.advogado.uf_oab : ""}`
      : null,
  }));
  return {
    hash: item.hash ?? null,
    numeroProcesso: item.numeroprocessocommascara ?? item.numero_processo ?? null,
    siglaTribunal: item.siglaTribunal ?? null,
    tipoComunicacao: item.tipoComunicacao ?? null,
    nomeOrgao: item.nomeOrgao ?? null,
    texto: item.texto ?? "",
    dataDisponibilizacao: item.data_disponibilizacao ?? null,
    meio: item.meiocompleto ?? item.meio ?? null,
    link: item.link ?? null,
    destinatarios: (item.destinatarios ?? []).map((d) => d.nome ?? "").filter(Boolean),
    advogados,
  };
}

/**
 * Monta as identidades-alvo do advogado a partir da env `OAB_ADVOGADO`.
 * Formato: seccionais separadas por ";" ou "," (ex.: "11158/MT;43972/SC"). Entradas que não
 * parseiam são descartadas. Vazio quando a env não está definida.
 */
export function oabsDoAmbiente(): IdentidadeOab[] {
  const raw = process.env.OAB_ADVOGADO;
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((p) => parseOab(p.trim()))
    .filter((x): x is IdentidadeOab => x !== null);
}

/**
 * Busca intimações/publicações do DJEN por OAB.
 * Faz até `tentativas` chamadas em caso de 403/5xx antes de desistir.
 * Se `params.oabsAlvo` estiver presente, filtra o resultado pela identidade do advogado
 * (número + UF), juntando os vários formatos da OAB e cortando homônimos.
 */
/**
 * Formas de inscrição a consultar. Com letra, consulta as DUAS ("11158-B" e "11158"): a API
 * indexa cada forma separadamente e cada uma devolve tribunais diferentes, então só a união
 * cobre a carteira inteira. Sem letra, uma consulta só.
 */
function variantesDeOab(numero: string, letra?: string | null): string[] {
  const limpo = numero.replace(/\D/g, "");
  const comLetra = letra ? `${limpo}-${letra.toUpperCase()}` : null;
  return comLetra ? [comLetra, limpo] : [limpo];
}

export async function buscarIntimacoes(
  params: BuscarIntimacoesParams,
  tentativas = 3,
): Promise<ComunicacaoDJEN[]> {
  const variantes = variantesDeOab(params.numeroOab, params.letraOab);

  // União das variantes, deduplicada pelo hash do DJEN (a mesma comunicação pode aparecer
  // nas duas consultas). Sem hash, cai para processo + data como chave.
  const porChave = new Map<string, ComunicacaoDJEN>();
  let ultimoErro: unknown = null;
  let algumaOk = false;
  for (const numeroOab of variantes) {
    try {
      const itens = await buscarIntimacoesRaw({ ...params, numeroOab }, tentativas);
      algumaOk = true;
      for (const c of itens) {
        const chave = c.hash ?? `${c.numeroProcesso ?? "?"}|${c.dataDisponibilizacao ?? "?"}|${c.texto.slice(0, 40)}`;
        if (!porChave.has(chave)) porChave.set(chave, c);
      }
    } catch (e) {
      ultimoErro = e;
    }
  }
  // Se NENHUMA variante respondeu, é falha: não devolver lista vazia, que se confunde com
  // "não há intimação".
  if (!algumaOk && ultimoErro) throw ultimoErro;

  const itens = [...porChave.values()];
  const alvos = params.oabsAlvo;
  if (!alvos || alvos.length === 0) return itens;
  return itens.filter((c) => c.advogados.some((a) => a.oab != null && ehDoAdvogado(a.oab, alvos)));
}

async function buscarIntimacoesRaw(
  params: BuscarIntimacoesParams,
  tentativas: number,
): Promise<ComunicacaoDJEN[]> {
  const url = montarUrlComunica(params);
  let ultimoStatus: number | undefined;

  for (let i = 0; i < tentativas; i++) {
    let resp: Response;
    try {
      resp = await fetch(url, { headers: BROWSER_HEADERS });
    } catch (e) {
      if (i === tentativas - 1)
        throw new ComunicaError(`Falha de rede ao chamar a Comunica: ${(e as Error).message}`);
      await sleep(500 * (i + 1));
      continue;
    }

    ultimoStatus = resp.status;
    if (resp.ok) {
      const json = (await resp.json()) as { items?: ComunicaRawItem[] };
      return (json.items ?? []).map(normalizar);
    }
    if (resp.status === 403) {
      if (i === tentativas - 1) {
        // Fora do Brasil o DJEN geobloqueia e o fallback de navegador também não passa;
        // COMUNICA_SEM_BROWSER=1 pula o fallback e devolve erro claro (evita travar).
        if (process.env.COMUNICA_SEM_BROWSER === "1") {
          throw new ComunicaError(
            "DJEN retornou 403 (WAF/geobloqueio) e o fallback de navegador está desativado. " +
              "Rode a coleta de um IP brasileiro (VPS ou máquina no Brasil).",
            403,
            true,
          );
        }
        // O fetch direto tomou 403 do AWS WAF. Delega ao navegador real (Playwright),
        // que carrega o SPA, deixa o SDK do WAF emitir o aws-waf-token e dispara a
        // consulta por dentro da página (same-origin). Import dinâmico para não
        // carregar o Playwright quando o caminho barato já resolve.
        const { consultarViaBrowser } = await import("./comunica-browser.js");
        return await consultarViaBrowser(params);
      }
      await sleep(700 * (i + 1));
      continue;
    }
    if (resp.status >= 500) {
      if (i === tentativas - 1)
        throw new ComunicaError(`Comunica indisponível (${resp.status}).`, resp.status);
      await sleep(700 * (i + 1));
      continue;
    }
    // 4xx que não seja 403: erro de parâmetro, não adianta repetir
    const txt = await resp.text().catch(() => "");
    throw new ComunicaError(`Comunica retornou ${resp.status}. ${txt.slice(0, 200)}`, resp.status);
  }

  throw new ComunicaError(`Comunica não respondeu com sucesso (último status ${ultimoStatus}).`, ultimoStatus);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
