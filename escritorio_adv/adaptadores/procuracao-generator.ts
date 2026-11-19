/**
 * Gerador estruturado de Procuração Ad Judicia et Extra para Daniel Felix Advocacia.
 * Segue as regras estritas da OAB e validação defensável de campos.
 */
import { createHash } from "node:crypto";

export interface OutorganteDados {
  nome: string;
  nacionalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  cpf: string;
  rg?: string;
  orgaoExpedidor?: string;
  endereco: string;
  email?: string;
  telefone?: string;
}

export interface AdvogadoOutorgado {
  nome: string;
  oabNumero: string;
  oabUf: string;
  enderecoProfissional?: string;
  emailProfissional?: string;
}

export interface PoderesEspeciais {
  receberEDarQuitacao?: boolean;
  transigirEAcordar?: boolean;
  firmarCompromisso?: boolean;
  confessar?: boolean;
  desistirERenunciar?: boolean;
  substabelecerComReserva?: boolean;
  substabelecerSemReserva?: boolean;
  levantarValoresRpvPrecatorio?: boolean;
}

export interface GerarProcuracaoInput {
  outorgante: OutorganteDados;
  advogado?: Partial<AdvogadoOutorgado>;
  poderesEspeciais?: PoderesEspeciais;
  finalidadeEspecifica?: string;
}

export interface ProcuracaoGerada {
  versao: number;
  titulo: string;
  html: string;
  textoPuro: string;
  sha256: string;
  camposPendentes: string[];
  poderesAutorizados: string[];
  advogadoResponsavel: AdvogadoOutorgado;
}

export const ADVOGADO_PADRAO: AdvogadoOutorgado = {
  nome: "DANIEL FELIX",
  oabNumero: "000.000", // A ser preenchido/configurado no ambiente do cliente
  oabUf: "SP",
  enderecoProfissional: "Endereço Profissional Daniel Felix Advocacia",
  emailProfissional: "contato@danielfelixadv.com.br",
};

export function gerarProcuracao(input: GerarProcuracaoInput): ProcuracaoGerada {
  const camposPendentes: string[] = [];
  const o = input.outorgante;

  if (!o.nome?.trim()) camposPendentes.push("nome do outorgante");
  if (!o.cpf?.trim()) camposPendentes.push("CPF do outorgante");
  if (!o.endereco?.trim()) camposPendentes.push("endereço completo do outorgante");

  if (camposPendentes.length > 0) {
    throw new Error(
      `Dados incompletos para geração de procuração. Campos pendentes: ${camposPendentes.join(", ")}. Nunca gere procuração com suposições fictícias.`
    );
  }

  const adv: AdvogadoOutorgado = {
    nome: input.advogado?.nome || ADVOGADO_PADRAO.nome,
    oabNumero: input.advogado?.oabNumero || ADVOGADO_PADRAO.oabNumero,
    oabUf: input.advogado?.oabUf || ADVOGADO_PADRAO.oabUf,
    enderecoProfissional: input.advogado?.enderecoProfissional || ADVOGADO_PADRAO.enderecoProfissional,
    emailProfissional: input.advogado?.emailProfissional || ADVOGADO_PADRAO.emailProfissional,
  };

  const poderesLista: string[] = [];
  const pe = input.poderesEspeciais || {};
  if (pe.receberEDarQuitacao) poderesLista.push("receber e dar quitação");
  if (pe.transigirEAcordar) poderesLista.push("transigir e firmar acordos judiciais ou extrajudiciais");
  if (pe.firmarCompromisso) poderesLista.push("firmar compromisso");
  if (pe.confessar) poderesLista.push("confessar");
  if (pe.desistirERenunciar) poderesLista.push("desistir e renunciar ao direito sobre o qual se funda a ação");
  if (pe.levantarValoresRpvPrecatorio) poderesLista.push("requerer e levantar alvarás judiciais, RPVs e precatórios");
  if (pe.substabelecerComReserva) poderesLista.push("substabelecer com reserva de iguais poderes");
  if (pe.substabelecerSemReserva) poderesLista.push("substabelecer sem reserva de poderes");

  const poderesEspeciaisTexto = poderesLista.length > 0
    ? `podendo, ainda, nos termos do art. 105 do CPC, especialmente: ${poderesLista.join("; ")};`
    : "restringindo-se aos poderes gerais para o foro (cláusula ad judicia et extra), sem poderes especiais;";

  const qualificacaoOutorgante = [
    o.nome,
    o.nacionalidade || "brasileiro(a)",
    o.estadoCivil || "estado civil não informado",
    o.profissao || "profissão não informada",
    `portador(a) do documento de identidade/CPF nº ${o.cpf}`,
    o.rg ? `RG nº ${o.rg}${o.orgaoExpedidor ? ` ${o.orgaoExpedidor}` : ""}` : "",
    `residente e domiciliado(a) em ${o.endereco}`,
    o.email ? `e-mail: ${o.email}` : "",
    o.telefone ? `telefone: ${o.telefone}` : "",
  ].filter(Boolean).join(", ");

  const qualificacaoAdvogado = `${adv.nome}, advogado(a) devidamente inscrito(a) nos quadros da Ordem dos Advogados do Brasil sob o nº OAB/${adv.oabUf} ${adv.oabNumero}, com endereço profissional em ${adv.enderecoProfissional}, e-mail: ${adv.emailProfissional}`;

  const finalidade = input.finalidadeEspecifica
    ? `<p><strong>FINALIDADE ESPECÍFICA:</strong> ${input.finalidadeEspecifica}</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>PROCURAÇÃO AD JUDICIA ET EXTRA</title>
<style>
body { font-family: "Georgia", serif; font-size: 12pt; line-height: 1.6; margin: 2.5cm; color: #1a1a1a; }
h1 { text-align: center; font-size: 15pt; letter-spacing: 2px; margin-bottom: 2rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
p { text-align: justify; text-indent: 1.5cm; margin-bottom: 1rem; }
.sem-indent { text-indent: 0; }
.data-local { text-align: right; margin-top: 3rem; }
.assinatura { text-align: center; margin-top: 4rem; border-top: 1px solid #555; width: 60%; margin-left: auto; margin-right: auto; padding-top: 0.5rem; }
</style>
</head>
<body>
<h1>PROCURAÇÃO AD JUDICIA ET EXTRA</h1>
<p class="sem-indent"><strong>OUTORGANTE:</strong> ${qualificacaoOutorgante}.</p>
<p class="sem-indent"><strong>OUTORGADO:</strong> ${qualificacaoAdvogado}.</p>
<p><strong>PODERES:</strong> Por este instrumento particular de mandato, o(a) OUTORGANTE nomeia e constitui o(a) OUTORGADO(A) como seu(sua) bastante procurador(a), conferindo-lhe amplos poderes gerais para o foro em geral, consubstanciados na cláusula <em>AD JUDICIA ET EXTRA</em>, em qualquer Juízo, Instância ou Tribunal, ou perante quaisquer órgãos da administração pública direta ou indireta, autarquias e cartórios, ${poderesEspeciaisTexto} tudo para a fiel e integral defesa dos direitos e interesses do(a) outorgante.</p>
${finalidade}
<p class="data-local">[Localidade], ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}.</p>
<div class="assinatura">
  <strong>${o.nome}</strong><br/>
  Outorgante (Assinatura Eletrônica)
</div>
</body>
</html>
`.trim();

  const textoPuro = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const sha256 = createHash("sha256").update(html, "utf8").digest("hex");

  return {
    versao: 1,
    titulo: `Procuração - ${o.nome}`,
    html,
    textoPuro,
    sha256,
    camposPendentes,
    poderesAutorizados: poderesLista,
    advogadoResponsavel: adv,
  };
}
