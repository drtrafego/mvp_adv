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
 * entre execuções. Se o fetch interno falhar, tenta raspar a tabela do SPA. Se tudo falhar,
 * lança ComunicaError(bloqueadoPorWAF=true): NUNCA devolve array vazio numa falha
 * (vazio = "não havia intimação"; falha = erro visível).
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

/** userDataDir do contexto persistente: env COMUNICA_PROFILE_DIR ou %LOCALAPPDATA%/gabinete/comunica-profile. */
function userDataDir(): string {
  if (process.env.COMUNICA_PROFILE_DIR) return process.env.COMUNICA_PROFILE_DIR;
  const base =
    process.env.LOCALAPPDATA ??
    process.env.APPDATA ??
    path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".local", "share");
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
 * Fallback: raspa a tabela de resultados do SPA. Best-effort. Só retorna um array quando
 * consegue identificar positivamente o estado da tela (linhas de resultado OU mensagem de
 * "nenhum resultado"). Se não conseguir ler a tela com confiança, retorna null para o
 * chamador tratar como falha, nunca como "sem intimação".
 */
async function rasparTabela(page: Page): Promise<ComunicacaoDJEN[] | null> {
  try {
    // Estado de vazio explícito do Angular Material.
    const textoPagina = (await page.locator("body").innerText().catch(() => "")) || "";
    const semResultado = /nenhum(a)?\s+(resultado|comunica|registro)/i.test(textoPagina);

    const cards = page.locator("mat-card, .lista-comunicacao, table tbody tr");
    const total = await cards.count();
    if (total === 0) {
      return semResultado ? [] : null;
    }

    const itens: ComunicacaoDJEN[] = [];
    for (let i = 0; i < total; i++) {
      const bruto = (await cards.nth(i).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      if (!bruto) continue;
      itens.push({
        hash: null,
        numeroProcesso: (bruto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) ?? [null])[0],
        siglaTribunal: null,
        tipoComunicacao: null,
        nomeOrgao: null,
        texto: bruto,
        dataDisponibilizacao: (bruto.match(/\d{2}\/\d{2}\/\d{4}/) ?? [null])[0],
        meio: "DJEN",
        link: null,
        destinatarios: [],
        advogados: [],
      });
    }
    return itens.length > 0 ? itens : semResultado ? [] : null;
  } catch {
    return null;
  }
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

      // fetch interno falhou: tenta o fallback de raspagem do SPA.
      const raspado = await rasparTabela(page);
      if (raspado !== null) return raspado;

      ultimoErro = new ComunicaError(
        `Consulta por dentro do SPA falhou (HTTP ${resultado.status})${
          resultado.erro ? `: ${resultado.erro}` : ""
        } e a raspagem da tabela não foi conclusiva.`,
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
