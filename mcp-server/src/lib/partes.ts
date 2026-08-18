/**
 * Reconhecimento das partes do processo, determinístico (sem modelo).
 *
 * A API Pública do DataJud não devolve as partes, então `processos.partes` está vazia em toda a
 * carteira e é coluna DEPRECADA. A única fonte estruturada hoje é `comunicacoes.destinatarios`
 * ([{nome, polo}], A = ativo, P = passivo), mais a qualificação no inteiro teor da intimação.
 *
 * A regra de decisão do produto:
 *
 * - Todas as comunicações do processo intimam UM ÚNICO POLO: a identificação é segura, o cliente
 *   e o vínculo são gravados com `origem = 'maquina'` (amarelo no painel) e o advogado confirma
 *   depois. É o mesmo modelo dos prazos.
 * - Há destinatário dos DOIS polos: nada é gravado em `clientes` nem em `processo_partes`. A
 *   detecção fica como sugestão pendente, para o advogado decidir. Exibir a parte contrária como
 *   cliente é pior que campo vazio.
 */

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./db.js";
import * as schema from "./schema.js";

export type Confianca = "alta" | "media" | "baixa";
export type FonteParte = "djen_destinatario" | "teor_intimacao" | "manual";

/** Sufixos societários equivalentes, para o mesmo nome não virar dois clientes. */
const EQUIVALENCIAS: Array<[RegExp, string]> = [
  [/\bSOCIEDADE ANONIMA\b/g, "SA"],
  [/\bSOCIEDADE LIMITADA\b/g, "LTDA"],
  [/\bLIMITADA\b/g, "LTDA"],
  [/\bLTDA\b/g, "LTDA"],
  [/\bS A\b/g, "SA"],
  [/\bCOMPANHIA\b/g, "CIA"],
  [/\bMICROEMPRESA\b/g, "ME"],
  [/\bMICRO EMPRESA\b/g, "ME"],
  [/\bMEI\b/g, "MEI"],
  [/\bEPP\b/g, "EPP"],
  [/\bEIRELI\b/g, "EIRELI"],
];

/**
 * Chave de comparação de nome: maiúsculas, sem acento, sem pontuação, espaços colapsados e
 * sufixo societário padronizado. O `nome` original NUNCA é alterado: ele é o que o advogado lê.
 */
export function normalizarNome(nome: string): string {
  let s = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  s = s.replace(/&/g, " E ");
  s = s.replace(/[^A-Z0-9]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (const [de, para] of EQUIVALENCIAS) s = s.replace(de, para);
  return s.replace(/\s+/g, " ").trim();
}

/** Papel neutro derivado do polo: nomear "autor" ou "exequente" já seria afirmar o rito. */
export function papelDoPolo(polo: string | null | undefined): string {
  const p = (polo ?? "").trim().toUpperCase();
  if (p === "A") return "polo ativo";
  if (p === "P") return "polo passivo";
  return "parte";
}

/**
 * O DJEN preenche o destinatário com um rótulo quando não pode nomear a parte (segredo de
 * justiça, por exemplo). Isso não é nome de gente: nunca vira sugestão de cliente, senão a
 * carteira ganha um "cliente SEGREDO". A linha continua na fila, para o advogado ver que o
 * processo existe e não tem parte legível.
 */
const NOMES_PLACEHOLDER = new Set([
  "SEGREDO",
  "SEGREDO DE JUSTICA",
  "SIGILO",
  "SIGILOSO",
  "NAO INFORMADO",
  "NAO IDENTIFICADO",
  "USUARIO DO SISTEMA",
  "A APURAR",
]);

export interface ParteBruta {
  nome: string;
  polo?: string | null;
  comunicacaoId?: string | null;
}

export interface ParteClassificada {
  nome: string;
  nomeChave: string;
  polo: string | null;
  papelSugerido: string;
  confianca: Confianca;
  eClienteSugerido: boolean;
  justificativa: string | null;
  comunicacaoId: string | null;
}

export interface OpcoesClassificacao {
  /** nomeChave -> processos em que o advogado JÁ confirmou aquele nome como cliente. */
  confirmadosPeloAdvogado?: Map<string, string[]>;
}

/**
 * Classifica as partes de UM processo a partir dos destinatários de todas as suas comunicações.
 *
 * Polo único em tudo: confiança alta e sugestão de cliente. Polos misturados: confiança baixa e
 * nenhuma sugestão. O cruzamento com um nome que o advogado já confirmou em outro processo sobe
 * a confiança um degrau (baixa -> média) e entra na justificativa, mas nunca sozinho transforma
 * polo ambíguo em alta: quem decide entre autor e réu é o advogado.
 */
export function classificarPartes(
  brutas: ParteBruta[],
  opcoes: OpcoesClassificacao = {},
): ParteClassificada[] {
  const validas = brutas.filter((b) => (b.nome ?? "").trim().length > 0);
  if (validas.length === 0) return [];

  const polos = new Set(
    validas.map((b) => (b.polo ?? "").trim().toUpperCase()).filter((p) => p.length > 0),
  );
  const todosTemPolo = validas.every((b) => (b.polo ?? "").trim().length > 0);
  const poloUnico = todosTemPolo && polos.size === 1;

  const porChave = new Map<string, ParteClassificada>();
  for (const b of validas) {
    const nome = b.nome.trim();
    const nomeChave = normalizarNome(nome);
    if (!nomeChave) continue;
    const polo = (b.polo ?? "").trim().toUpperCase() || null;
    const chave = `${nomeChave}|${polo ?? ""}`;
    if (porChave.has(chave)) continue;

    const confirmadoEm = opcoes.confirmadosPeloAdvogado?.get(nomeChave) ?? [];
    const cruzou = confirmadoEm.length > 0;
    const placeholder = NOMES_PLACEHOLDER.has(nomeChave);
    const confianca: Confianca = placeholder
      ? "baixa"
      : poloUnico
        ? "alta"
        : cruzou
          ? "media"
          : "baixa";

    const razoes: string[] = [];
    if (placeholder) {
      razoes.push(
        `"${nome}" é o rótulo que o DJEN usa quando não pode nomear a parte (segredo de justiça), ` +
          "não um nome de parte. Nada foi gravado como cliente.",
      );
    } else if (poloUnico) {
      razoes.push(
        `Todas as intimações deste processo têm destinatário de um único polo (${polo ?? "?"}), ` +
          "então a parte intimada é a que o escritório representa.",
      );
    } else {
      razoes.push(
        `As intimações deste processo trazem destinatários dos dois polos (${[...polos].join(", ")}), ` +
          "então não dá para deduzir de que lado está o cliente.",
      );
    }
    if (cruzou) {
      razoes.push(
        `Mesmo nome já confirmado pelo advogado como cliente em ${confirmadoEm.length} ` +
          `processo(s): ${confirmadoEm.slice(0, 3).join(", ")}.`,
      );
    }

    porChave.set(chave, {
      nome,
      nomeChave,
      polo,
      papelSugerido: papelDoPolo(polo),
      confianca,
      eClienteSugerido: poloUnico && !placeholder,
      justificativa: razoes.join(" "),
      comunicacaoId: b.comunicacaoId ?? null,
    });
  }
  return [...porChave.values()];
}

export interface ResultadoDeteccao {
  processoId: string;
  /** Partes distintas reconhecidas (nome + polo). */
  detectadas: ParteClassificada[];
  polos: string[];
  poloUnico: boolean;
  /** Nenhuma comunicação do processo trouxe destinatário. */
  semFonte: boolean;
}

/** nomeChave -> números de processo em que o advogado confirmou aquele nome como cliente. */
async function confirmadosPeloAdvogado(processoIdExcluido: string): Promise<Map<string, string[]>> {
  const d = getDb();
  const rows = await d
    .select({ nome: schema.clientes.nome, numeroCnj: schema.processos.numeroCnj })
    .from(schema.processoPartes)
    .innerJoin(schema.clientes, eq(schema.processoPartes.clienteId, schema.clientes.id))
    .innerJoin(schema.processos, eq(schema.processoPartes.processoId, schema.processos.id))
    .where(
      and(
        eq(schema.processoPartes.origem, "humana"),
        ne(schema.processoPartes.processoId, processoIdExcluido),
      ),
    );
  const mapa = new Map<string, string[]>();
  for (const r of rows) {
    const chave = normalizarNome(r.nome);
    if (!chave) continue;
    mapa.set(chave, [...(mapa.get(chave) ?? []), r.numeroCnj]);
  }
  return mapa;
}

/**
 * Lê as comunicações do processo, explode os destinatários e faz upsert em `partes_detectadas`
 * com `fonte = 'djen_destinatario'`.
 *
 * O upsert nunca mexe em linha que o humano já decidiu (status diferente de 'sugerido') nem em
 * linha vinda do teor da intimação: a releitura do DJEN não apaga leitura de gente.
 */
export async function detectarPartesDoProcesso(
  processoId: string,
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoDeteccao> {
  const d = getDb();
  const coms = await d
    .select({ id: schema.comunicacoes.id, destinatarios: schema.comunicacoes.destinatarios })
    .from(schema.comunicacoes)
    .where(eq(schema.comunicacoes.processoId, processoId));

  const brutas: ParteBruta[] = [];
  for (const c of coms) {
    const lista = Array.isArray(c.destinatarios)
      ? (c.destinatarios as Array<{ nome?: string; polo?: string }>)
      : [];
    for (const item of lista) {
      if (!item?.nome) continue;
      brutas.push({ nome: item.nome, polo: item.polo ?? null, comunicacaoId: c.id });
    }
  }

  const detectadas = classificarPartes(brutas, {
    confirmadosPeloAdvogado: await confirmadosPeloAdvogado(processoId),
  });
  const polos = [...new Set(brutas.map((b) => (b.polo ?? "").trim().toUpperCase()).filter(Boolean))];
  const todosTemPolo = brutas.length > 0 && brutas.every((b) => (b.polo ?? "").trim().length > 0);
  const poloUnico = todosTemPolo && polos.length === 1;

  if (!opcoes.simular) {
    for (const p of detectadas) {
      await d.execute(sql`
        insert into ${schema.partesDetectadas}
          (processo_id, comunicacao_id, nome, nome_chave, polo, papel_sugerido, fonte,
           confianca, e_cliente_sugerido, justificativa)
        values (${processoId}, ${p.comunicacaoId}, ${p.nome}, ${p.nomeChave}, ${p.polo},
                ${p.papelSugerido}, 'djen_destinatario', ${p.confianca}, ${p.eClienteSugerido},
                ${p.justificativa})
        on conflict (processo_id, nome_chave, coalesce(polo, '')) do update
          set confianca = excluded.confianca,
              e_cliente_sugerido = excluded.e_cliente_sugerido,
              justificativa = excluded.justificativa,
              papel_sugerido = excluded.papel_sugerido,
              comunicacao_id = coalesce(partes_detectadas.comunicacao_id, excluded.comunicacao_id)
          where partes_detectadas.status = 'sugerido'
            and partes_detectadas.fonte = 'djen_destinatario'
      `);
    }
  }

  return { processoId, detectadas, polos, poloUnico, semFonte: brutas.length === 0 };
}

export interface ResultadoAplicacao {
  processoId: string;
  /** Vínculos processo <-> cliente gravados com origem 'maquina'. */
  aplicados: number;
  /** Clientes criados agora (os demais foram reaproveitados por nome_chave). */
  clientesCriados: number;
  nomes: string[];
  /** vinculo_humano: o advogado já decidiu este processo, o motor não toca. */
  motivo?: "vinculo_humano" | "sem_deteccao_segura";
}

/**
 * Grava o cliente das detecções seguras (confiança alta) com `origem = 'maquina'`.
 *
 * A detecção continua com `status = 'sugerido'`, só ganha o `cliente_id`: confirmado é palavra do
 * humano. Se o processo já tem vínculo `origem = 'humana'`, nada é tocado.
 */
export async function aplicarClientesSeguros(
  processoId: string,
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoAplicacao> {
  const d = getDb();

  const [humano] = await d
    .select({ id: schema.processoPartes.id })
    .from(schema.processoPartes)
    .where(
      and(eq(schema.processoPartes.processoId, processoId), eq(schema.processoPartes.origem, "humana")),
    )
    .limit(1);
  if (humano)
    return {
      processoId,
      aplicados: 0,
      clientesCriados: 0,
      nomes: [],
      motivo: "vinculo_humano",
    };

  const seguras = await d
    .select()
    .from(schema.partesDetectadas)
    .where(
      and(
        eq(schema.partesDetectadas.processoId, processoId),
        eq(schema.partesDetectadas.status, "sugerido"),
        eq(schema.partesDetectadas.confianca, "alta"),
        eq(schema.partesDetectadas.eClienteSugerido, true),
      ),
    );
  if (seguras.length === 0)
    return {
      processoId,
      aplicados: 0,
      clientesCriados: 0,
      nomes: [],
      motivo: "sem_deteccao_segura",
    };

  const cadastrados = await d
    .select({ id: schema.clientes.id, nome: schema.clientes.nome })
    .from(schema.clientes);
  const porChave = new Map(cadastrados.map((c) => [normalizarNome(c.nome), c.id]));

  let aplicados = 0;
  let clientesCriados = 0;
  const nomes: string[] = [];

  for (const [i, det] of seguras.entries()) {
    let clienteId = porChave.get(det.nomeChave);
    if (!clienteId) {
      clientesCriados++;
      if (!opcoes.simular) {
        const [novo] = await d
          .insert(schema.clientes)
          .values({ nome: det.nome })
          .returning({ id: schema.clientes.id });
        clienteId = novo.id;
        porChave.set(det.nomeChave, clienteId);
      }
    }
    nomes.push(det.nome);
    aplicados++;

    if (opcoes.simular || !clienteId) continue;

    await d
      .insert(schema.processoPartes)
      .values({
        processoId,
        clienteId,
        papel: det.papelSugerido ?? papelDoPolo(det.polo),
        principal: i === 0,
        origem: "maquina",
        polo: det.polo,
      })
      .onConflictDoNothing();

    await d
      .update(schema.partesDetectadas)
      .set({ clienteId })
      .where(eq(schema.partesDetectadas.id, det.id));
  }

  // Cache do nome na carteira. Só preenche o que está vazio: nome já escrito pode ter vindo do
  // advogado, e o motor não sobrescreve gente.
  if (!opcoes.simular && nomes.length > 0) {
    await d
      .update(schema.processos)
      .set({ clienteNome: nomes[0] })
      .where(
        and(
          eq(schema.processos.id, processoId),
          sql`coalesce(${schema.processos.clienteNome}, '') = ''`,
        ),
      );
  }

  return { processoId, aplicados, clientesCriados, nomes };
}

export interface ResumoPartes {
  processoId: string;
  vinculos: Array<{
    clienteId: string;
    nome: string;
    papel: string;
    principal: boolean | null;
    origem: string | null;
    polo: string | null;
  }>;
  detectadas: Array<{
    id: string;
    nome: string;
    polo: string | null;
    confianca: string;
    fonte: string;
    status: string;
    eClienteSugerido: boolean;
    justificativa: string | null;
    clienteId: string | null;
  }>;
  /** Detecções ainda esperando decisão do advogado. */
  aConfirmar: number;
  /** Tem vínculo, mas todos de máquina: no painel isso é amarelo. */
  soSugerido: boolean;
}

/** O estado das partes de um processo, para o painel e para o retorno das tools. */
export async function resumoPartes(processoId: string): Promise<ResumoPartes> {
  const d = getDb();

  const vinculos = await d
    .select({
      clienteId: schema.processoPartes.clienteId,
      nome: schema.clientes.nome,
      papel: schema.processoPartes.papel,
      principal: schema.processoPartes.principal,
      origem: schema.processoPartes.origem,
      polo: schema.processoPartes.polo,
    })
    .from(schema.processoPartes)
    .innerJoin(schema.clientes, eq(schema.processoPartes.clienteId, schema.clientes.id))
    .where(eq(schema.processoPartes.processoId, processoId))
    .orderBy(desc(schema.processoPartes.principal));

  const detectadas = await d
    .select({
      id: schema.partesDetectadas.id,
      nome: schema.partesDetectadas.nome,
      polo: schema.partesDetectadas.polo,
      confianca: schema.partesDetectadas.confianca,
      fonte: schema.partesDetectadas.fonte,
      status: schema.partesDetectadas.status,
      eClienteSugerido: schema.partesDetectadas.eClienteSugerido,
      justificativa: schema.partesDetectadas.justificativa,
      clienteId: schema.partesDetectadas.clienteId,
    })
    .from(schema.partesDetectadas)
    .where(eq(schema.partesDetectadas.processoId, processoId))
    .orderBy(desc(schema.partesDetectadas.criadoEm));

  return {
    processoId,
    vinculos,
    detectadas,
    aConfirmar: detectadas.filter((x) => x.status === "sugerido").length,
    soSugerido: vinculos.length > 0 && vinculos.every((v) => v.origem === "maquina"),
  };
}

/** Reconhece as partes e aplica o que for seguro. É o par que roda em todo ponto de entrada. */
export async function organizarPartes(
  processoId: string,
  opcoes: { simular?: boolean } = {},
): Promise<{ deteccao: ResultadoDeteccao; aplicacao: ResultadoAplicacao }> {
  const deteccao = await detectarPartesDoProcesso(processoId, opcoes);
  const aplicacao = await aplicarClientesSeguros(processoId, opcoes);
  return { deteccao, aplicacao };
}

// ---------------------------------------------------------------------------
// Fila de decisão e caminho humano (usados pelas tools do MCP)
// ---------------------------------------------------------------------------

export interface PartePendente {
  id: string;
  processoId: string;
  numeroCnj: string;
  classe: string | null;
  nome: string;
  polo: string | null;
  papelSugerido: string | null;
  fonte: string;
  confianca: string;
  eClienteSugerido: boolean;
  justificativa: string | null;
  trechoFonte: string | null;
  clienteId: string | null;
  teor: string | null;
}

/** Detecções ainda no estado 'sugerido', com o teor recortado da intimação de origem. */
export async function listarPartesPendentes(limite = 40): Promise<PartePendente[]> {
  const d = getDb();
  const rows = await d
    .select({
      id: schema.partesDetectadas.id,
      processoId: schema.partesDetectadas.processoId,
      numeroCnj: schema.processos.numeroCnj,
      classe: schema.processos.classe,
      nome: schema.partesDetectadas.nome,
      polo: schema.partesDetectadas.polo,
      papelSugerido: schema.partesDetectadas.papelSugerido,
      fonte: schema.partesDetectadas.fonte,
      confianca: schema.partesDetectadas.confianca,
      eClienteSugerido: schema.partesDetectadas.eClienteSugerido,
      justificativa: schema.partesDetectadas.justificativa,
      trechoFonte: schema.partesDetectadas.trechoFonte,
      clienteId: schema.partesDetectadas.clienteId,
      // Tira as tags (parte das intimações vem em HTML) e colapsa o espaço. Classe POSIX em vez
      // de '\s+': a barra invertida não sobrevive ao template do Drizzle e o padrão chegava ao
      // Postgres como 's+', que apagava todo "s" do teor.
      teor: sql<string | null>`(
        select left(
          regexp_replace(
            regexp_replace(coalesce(c.inteiro_teor, ''), '<[^>]*>', ' ', 'g'),
            '[[:space:]]+', ' ', 'g'
          ), 1500)
        from comunicacoes c
        where c.id = coalesce(${schema.partesDetectadas.comunicacaoId}, c.id)
          and c.processo_id = ${schema.partesDetectadas.processoId}
        order by c.data_disponibilizacao desc nulls last
        limit 1
      )`,
    })
    .from(schema.partesDetectadas)
    .innerJoin(schema.processos, eq(schema.partesDetectadas.processoId, schema.processos.id))
    .where(eq(schema.partesDetectadas.status, "sugerido"))
    .orderBy(
      // Alta primeiro: é a fila de trabalho, não uma listagem alfabética de confiança.
      sql`case ${schema.partesDetectadas.confianca} when 'alta' then 0 when 'media' then 1 else 2 end`,
      schema.processos.numeroCnj,
    )
    .limit(limite);
  return rows as PartePendente[];
}

/**
 * Grava o que o modelo leu no teor da intimação como SUGESTÃO. Não toca em `clientes` nem em
 * `processo_partes`: leitura de texto não é confirmação.
 */
export async function sugerirParteDoTeor(p: {
  processoId: string;
  nome: string;
  polo?: string | null;
  papelSugerido?: string | null;
  justificativa: string;
  trechoFonte: string;
  comunicacaoId?: string | null;
}): Promise<{ nomeChave: string }> {
  const d = getDb();
  const nome = p.nome.trim();
  const nomeChave = normalizarNome(nome);
  const polo = (p.polo ?? "").trim().toUpperCase() || null;
  await d.execute(sql`
    insert into ${schema.partesDetectadas}
      (processo_id, comunicacao_id, nome, nome_chave, polo, papel_sugerido, fonte,
       confianca, e_cliente_sugerido, justificativa, trecho_fonte)
    values (${p.processoId}, ${p.comunicacaoId ?? null}, ${nome}, ${nomeChave}, ${polo},
            ${p.papelSugerido ?? papelDoPolo(polo)}, 'teor_intimacao', 'media', false,
            ${p.justificativa}, ${p.trechoFonte})
    on conflict (processo_id, nome_chave, coalesce(polo, '')) do update
      set fonte = 'teor_intimacao',
          confianca = 'media',
          justificativa = excluded.justificativa,
          trecho_fonte = excluded.trecho_fonte,
          papel_sugerido = excluded.papel_sugerido,
          comunicacao_id = coalesce(excluded.comunicacao_id, partes_detectadas.comunicacao_id)
      where partes_detectadas.status = 'sugerido'
  `);
  return { nomeChave };
}

/**
 * Caminho humano: o advogado ditou quem é o cliente. Cria ou reaproveita o cadastro, grava o
 * vínculo com `origem = 'humana'` e fecha a detecção correspondente. A partir daqui o motor não
 * sobrescreve mais nada neste processo.
 */
export async function confirmarClienteHumano(p: {
  processoId: string;
  nome: string;
  papel: string;
  polo?: string | null;
  documento?: string | null;
  decididoPor?: string;
  principal?: boolean;
}): Promise<{ clienteId: string; descartadas: number }> {
  const d = getDb();
  const nome = p.nome.trim();
  const nomeChave = normalizarNome(nome);
  const documento = p.documento?.replace(/\D/g, "") || null;
  const decididoPor = p.decididoPor ?? "advogado";
  const polo = (p.polo ?? "").trim().toUpperCase() || null;

  const cadastrados = await d
    .select({ id: schema.clientes.id, nome: schema.clientes.nome, documento: schema.clientes.documento })
    .from(schema.clientes);
  let clienteId =
    (documento ? cadastrados.find((c) => c.documento === documento)?.id : undefined) ??
    cadastrados.find((c) => normalizarNome(c.nome) === nomeChave)?.id;

  if (!clienteId) {
    const [novo] = await d
      .insert(schema.clientes)
      .values({
        nome,
        documento,
        tipoDocumento: documento ? (documento.length > 11 ? "CNPJ" : "CPF") : null,
      })
      .returning({ id: schema.clientes.id });
    clienteId = novo.id;
  } else if (documento) {
    await d
      .update(schema.clientes)
      .set({ documento, tipoDocumento: documento.length > 11 ? "CNPJ" : "CPF" })
      .where(eq(schema.clientes.id, clienteId));
  }

  await d
    .insert(schema.processoPartes)
    .values({
      processoId: p.processoId,
      clienteId,
      papel: p.papel,
      principal: p.principal ?? true,
      origem: "humana",
      polo,
      confirmadoPor: decididoPor,
      confirmadoEm: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.processoPartes.processoId,
        schema.processoPartes.clienteId,
        schema.processoPartes.papel,
      ],
      set: {
        principal: p.principal ?? true,
        origem: "humana",
        polo,
        confirmadoPor: decididoPor,
        confirmadoEm: new Date(),
      },
    });

  await d
    .update(schema.processos)
    .set({ clienteNome: nome })
    .where(eq(schema.processos.id, p.processoId));

  await d
    .update(schema.partesDetectadas)
    .set({ status: "confirmado", clienteId, decididoPor, decididoEm: new Date() })
    .where(
      and(
        eq(schema.partesDetectadas.processoId, p.processoId),
        eq(schema.partesDetectadas.nomeChave, nomeChave),
        eq(schema.partesDetectadas.status, "sugerido"),
      ),
    );

  // Só o polo OPOSTO é descartado: litisconsorte do mesmo polo continua pendente, porque pode
  // ser cliente também.
  let descartadas = 0;
  if (polo) {
    const oposto = polo === "A" ? "P" : "A";
    const fora = await d
      .update(schema.partesDetectadas)
      .set({ status: "descartado", decididoPor, decididoEm: new Date() })
      .where(
        and(
          eq(schema.partesDetectadas.processoId, p.processoId),
          eq(schema.partesDetectadas.polo, oposto),
          eq(schema.partesDetectadas.status, "sugerido"),
        ),
      )
      .returning({ id: schema.partesDetectadas.id });
    descartadas = fora.length;
  }

  return { clienteId, descartadas };
}

/**
 * Cliente do processo por vínculo CONFIRMADO pelo advogado. É o único que autoriza colocar um
 * documento na pasta do cliente: vínculo de máquina não basta.
 */
export async function clienteHumanoDoProcesso(
  processoId: string,
): Promise<{ id: string; nome: string } | null> {
  const d = getDb();
  const [row] = await d
    .select({ id: schema.clientes.id, nome: schema.clientes.nome })
    .from(schema.processoPartes)
    .innerJoin(schema.clientes, eq(schema.processoPartes.clienteId, schema.clientes.id))
    .where(
      and(
        eq(schema.processoPartes.processoId, processoId),
        eq(schema.processoPartes.origem, "humana"),
      ),
    )
    .orderBy(desc(schema.processoPartes.principal))
    .limit(1);
  return row ?? null;
}
