/**
 * Cliente da API Pública do DataJud (CNJ).
 *
 * Endpoint por tribunal: https://api-publica.datajud.cnj.jus.br/api_publica_<alias>/_search
 * Autenticação: header Authorization: APIKey <chave-pública>.
 * A chave é pública e igual para todos (divulgada em datajud-wiki.cnj.jus.br/api-publica/acesso/).
 *
 * TESTADO AO VIVO em julho/2026.
 */

import { aliasDataJud, limparCNJ, formatarCNJ } from "./cnj.js";

const BASE = "https://api-publica.datajud.cnj.jus.br";
// Permite sobrescrever por env; cai na chave pública oficial se ausente.
const API_KEY =
  process.env.DATAJUD_API_KEY ??
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

export interface MovimentacaoDataJud {
  codigo: number | null;
  descricao: string;
  dataHora: string;
  complemento: unknown;
}

export interface ProcessoDataJud {
  numeroCNJ: string;
  tribunal: string | null;
  classe: string | null;
  assunto: string | null;
  orgaoJulgador: string | null;
  grau: string | null;
  valorCausa: number | null;
  dataAjuizamento: string | null;
  sistema: string | null;
  formato: string | null;
  movimentacoes: MovimentacaoDataJud[];
  encontrado: boolean;
}

interface DataJudHit {
  _source: {
    numeroProcesso?: string;
    tribunal?: string;
    grau?: string;
    dataAjuizamento?: string;
    classe?: { codigo?: number; nome?: string };
    assuntos?: Array<{ codigo?: number; nome?: string }>;
    orgaoJulgador?: { codigo?: number; nome?: string };
    valorCausa?: number;
    sistema?: { nome?: string };
    formato?: { nome?: string };
    movimentos?: Array<{
      codigo?: number;
      nome?: string;
      dataHora?: string;
      complementosTabelados?: unknown;
    }>;
  };
}

export class DataJudError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DataJudError";
  }
}

/**
 * Consulta um processo pelo número CNJ. Deriva o tribunal do próprio número.
 * `aliasManual` força o alias do endpoint quando o mapeamento automático não cobre o tribunal.
 */
export async function consultarProcesso(
  numeroCNJ: string,
  aliasManual?: string,
): Promise<ProcessoDataJud> {
  const digits = limparCNJ(numeroCNJ);
  const alias = aliasManual ?? aliasDataJud(numeroCNJ);
  if (!alias) {
    throw new DataJudError(
      `Não consegui identificar o tribunal do processo ${formatarCNJ(numeroCNJ)}. ` +
        `Informe o alias do DataJud manualmente (ex.: 'tjsp', 'trf1', 'trt2').`,
    );
  }

  const url = `${BASE}/api_publica_${alias}/_search`;
  const body = {
    size: 1,
    query: { match: { numeroProcesso: digits } },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new DataJudError(
      `DataJud retornou ${resp.status} para o alias '${alias}'. ${txt.slice(0, 200)}`,
      resp.status,
    );
  }

  const json = (await resp.json()) as { hits?: { hits?: DataJudHit[] } };
  const hit = json.hits?.hits?.[0];
  if (!hit) {
    return {
      numeroCNJ: formatarCNJ(numeroCNJ),
      tribunal: alias.toUpperCase(),
      classe: null,
      assunto: null,
      orgaoJulgador: null,
      grau: null,
      valorCausa: null,
      dataAjuizamento: null,
      sistema: null,
      formato: null,
      movimentacoes: [],
      encontrado: false,
    };
  }

  const s = hit._source;
  const movimentacoes: MovimentacaoDataJud[] = (s.movimentos ?? [])
    .map((m) => ({
      codigo: m.codigo ?? null,
      descricao: m.nome ?? "",
      dataHora: m.dataHora ?? "",
      complemento: m.complementosTabelados ?? null,
    }))
    .filter((m) => m.dataHora)
    .sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1)); // mais recente primeiro

  return {
    numeroCNJ: formatarCNJ(numeroCNJ),
    tribunal: s.tribunal ?? alias.toUpperCase(),
    classe: s.classe?.nome ?? null,
    assunto: s.assuntos?.[0]?.nome ?? null,
    orgaoJulgador: s.orgaoJulgador?.nome ?? null,
    grau: s.grau ?? null,
    valorCausa: s.valorCausa ?? null,
    dataAjuizamento: s.dataAjuizamento ?? null,
    sistema: s.sistema?.nome ?? null,
    formato: s.formato?.nome ?? null,
    movimentacoes,
    encontrado: true,
  };
}
