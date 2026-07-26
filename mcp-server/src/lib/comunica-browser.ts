/**
 * Coleta de intimações via navegador real (Playwright).
 *
 * O bloqueio da Comunica é AWS WAF (a tela "The request could not be satisfied" é do
 * CloudFront). O cookie que libera a API é o `aws-waf-token`, emitido pelo SDK JavaScript
 * da AWS que roda dentro do SPA. A saída robusta é abrir a página real na máquina do
 * advogado, deixar o SDK emitir o token e disparar a consulta por dentro da própria página
 * (fetch same-origin), para o navegador anexar cookies e assinatura sozinho.
 *
 * Contexto persistente (userDataDir fixo) para o token e o desafio do WAF sobreviverem
 * entre execuções. Se o fetch interno falhar, é FALHA: lança ComunicaError(bloqueadoPorWAF=true).
 * NUNCA devolve array vazio numa falha (vazio = "não havia intimação"; falha = erro visível).
 * Numa ferramenta de prazo, "não achei nada" e "não consegui perguntar" não podem se parecer.
 */

import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  ComunicaError,
  montarUrlComunica,
  normalizar,
  type BuscarIntimacoesParams,
  type ComunicacaoDJEN,
  type ComunicaRawItem,
} from "./comunica.js";

const CONSULTA_URL = "https://comunica.pje.jus.br/consulta";
const TIMEOUT_SESSAO_MS = 30_000;
const CICLOS = 2;

/** Diagnóstico opcional no stderr (stdout é o canal do protocolo MCP). Liga com COMUNICA_DEBUG=1. */
function dbg(msg: string): void {
  if (process.env.COMUNICA_DEBUG) console.error(`[comunica-browser] ${msg}`);
}

/**
 * userDataDir do contexto persistente. É onde mora o desafio resolvido do WAF: se o caminho
 * mudar entre execuções, cada rodada começa do zero e tende a apanhar do bloqueio.
 *
 * Cuidado com cron: ele roda com ambiente mínimo, muitas vezes SEM HOME. Antes, nesse caso, a
 * base virava "." (relativa ao diretório atual), então o perfil dependia de onde o processo foi
 * lançado. Agora, sem HOME, cai num caminho absoluto fixo dentro do próprio projeto, para o
 * perfil ser sempre o mesmo. Defina COMUNICA_PROFILE_DIR para escolher explicitamente.
 */
export function userDataDir(): string {
  if (process.env.COMUNICA_PROFILE_DIR) return process.env.COMUNICA_PROFILE_DIR;
  const base =
    process.env.LOCALAPPDATA ??
    process.env.APPDATA ??
    (process.env.HOME || process.env.USERPROFILE
      ? path.join((process.env.HOME ?? process.env.USERPROFILE) as string, ".local", "share")
      : path.resolve(new URL("../..", import.meta.url).pathname, ".perfil-navegador"));
  return path.join(base, "gabinete", "comunica-profile");
}

interface ResultadoFetchInterno {
  ok: boolean;
  status: number;
  items: ComunicaRawItem[] | null;
  erro?: string;
}

/**
 * Garante uma sessão aquecida: navega para a consulta, espera o SPA hidratar e o cookie
 * `aws-waf-token` aparecer. Timeout de 30s e 1 retentativa. Falha explícita se não carregar.
 */
async function garantirSessao(context: BrowserContext, page: Page): Promise<void> {
  let ultimoMotivo = "desconhecido";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      await page.goto(CONSULTA_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_SESSAO_MS });
      const prazo = Date.now() + TIMEOUT_SESSAO_MS;
      while (Date.now() < prazo) {
        const cookies = await context.cookies();
        const temToken = cookies.some((c) => c.name === "aws-waf-token" && Boolean(c.value));
        // A presença do formulário de consulta confirma que o SPA hidratou.
        const spaPronto = (await page.locator("input, mat-select, button").count()) > 0;
        if (temToken && spaPronto) {
          dbg(`sessão aquecida: aws-waf-token presente e SPA hidratado (tentativa ${tentativa + 1})`);
          return;
        }
        await page.waitForTimeout(1000);
      }
      ultimoMotivo = "SPA não emitiu o cookie aws-waf-token dentro do timeout (hidratação falhou)";
    } catch (e) {
      ultimoMotivo = (e as Error).message;
    }
    await page.waitForTimeout(1500);
  }
  throw new ComunicaError(`Não consegui aquecer a sessão da Comunica no navegador: ${ultimoMotivo}`, undefined, true);
}

/** Dispara a consulta na API por dentro da página (same-origin), com pequeno retry interno. */
async function consultarPorDentro(page: Page, url: string): Promise<ResultadoFetchInterno> {
  return page.evaluate(async (u: string): Promise<ResultadoFetchInterno> => {
    let ultimoStatus = 0;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(u, { headers: { Accept: "application/json" }, credentials: "include" });
        ultimoStatus = r.status;
        if (r.ok) {
          const j = (await r.json()) as { items?: ComunicaRawItem[] };
          return { ok: true, status: r.status, items: j.items ?? [] };
        }
        // 403 do WAF ou 5xx: espera e tenta de novo, o token pode estar assentando.
        if (r.status === 403 || r.status >= 500) {
          await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
          continue;
        }
        return { ok: false, status: r.status, items: null };
      } catch (e) {
        ultimoStatus = -1;
        await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
      }
    }
    return { ok: false, status: ultimoStatus, items: null };
  }, url);
}


/**
 * Consulta as intimações via navegador. Até 2 ciclos completos (contexto novo por ciclo).
 * Fecha o contexto no finally. Em falha total, lança ComunicaError(bloqueadoPorWAF=true).
 */
export async function consultarViaBrowser(params: BuscarIntimacoesParams): Promise<ComunicacaoDJEN[]> {
  const url = montarUrlComunica(params);
  let ultimoErro: Error | null = null;

  for (let ciclo = 0; ciclo < CICLOS; ciclo++) {
    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(userDataDir(), {
        headless: true,
        viewport: { width: 1366, height: 768 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        locale: "pt-BR",
      });
      const page = context.pages()[0] ?? (await context.newPage());

      await garantirSessao(context, page);

      const resultado = await consultarPorDentro(page, url);
      dbg(`ciclo ${ciclo + 1}: fetch interno HTTP ${resultado.status}, ok=${resultado.ok}, itens=${resultado.items?.length ?? "n/a"}`);
      if (resultado.ok && resultado.items) {
        // Sucesso legítimo: pode ser array vazio (não havia intimação) e tudo bem.
        return resultado.items.map(normalizar);
      }

      // O fetch interno falhou. NÃO caímos mais na raspagem da tela: a página aberta é o
      // formulário de consulta, onde nenhuma busca foi submetida (a consulta é feita por
      // fetch, não pela UI). Uma tabela vazia ali significa "ninguém pesquisou", e não
      // "não há intimação" — e devolver [] nesse ponto produz exatamente o pior resultado
      // possível: a coleta grava "ok, 0 intimações" todo dia enquanto o advogado é intimado.
      // Falha tem que aparecer como falha.
      ultimoErro = new ComunicaError(
        `Consulta por dentro do SPA falhou (HTTP ${resultado.status})${
          resultado.erro ? `: ${resultado.erro}` : ""
        }.`,
        resultado.status > 0 ? resultado.status : undefined,
        true,
      );
    } catch (e) {
      ultimoErro = e as Error;
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  throw new ComunicaError(
    `Coleta via navegador falhou após ${CICLOS} ciclo(s): ${ultimoErro?.message ?? "erro desconhecido"}`,
    ultimoErro instanceof ComunicaError ? ultimoErro.status : undefined,
    true,
  );
}
