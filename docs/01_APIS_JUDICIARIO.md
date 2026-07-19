# APIs do Judiciário Brasileiro — pesquisa e requisitos de acesso

> Fase 1 do projeto Gabinete. Documento de referência sobre de onde o sistema puxa dados
> processuais, intimações e documentos. Fatos verificados em julho de 2026 (DataJud testado
> ao vivo; chave pública conferida na wiki oficial do CNJ; Comunica/DJEN e MNI conferidos na
> documentação oficial). Valores e chaves podem mudar; sempre conferir a fonte oficial citada.

## Resumo executivo (o mapa)

Existem três camadas de acesso a dados judiciais no Brasil, e o Gabinete usa cada uma para uma coisa:

| Camada | Fonte | O que entrega | Custo | Acesso |
|---|---|---|---|---|
| **1. Metadados processuais** | **DataJud (CNJ)** | Capa do processo + todas as movimentações | Gratuito | Chave pública (sem cadastro) |
| **2. Intimações / prazos** | **Comunica API / DJEN (CNJ)** | Publicações dirigidas ao advogado, com inteiro teor | Gratuito | Consulta pública por OAB |
| **3. Documentos dos autos** | **MNI (tribunais)** ou **APIs pagas** (Judit, Escavador) | PDFs das peças, inteiro teor dos autos | Pago / certificado | Certificado ICP-Brasil ou API key comercial |

Regra de ouro do acesso: **metadado e intimação são públicos e de graça; documento inteiro dos autos exige credencial forte** (certificado do advogado habilitado ou intermediário pago). Segredo de justiça nunca aparece nas fontes gratuitas.

---

## 1. DataJud — API Pública do CNJ

A espinha dorsal. É a Base Nacional de Dados do Poder Judiciário, criada pela Resolução CNJ nº 331/2020. Reúne os metadados de processos de todos os tribunais (Justiça Estadual, Federal, Trabalho, Eleitoral, Militar e os Superiores).

**Status: TESTADO AO VIVO E FUNCIONANDO** (julho/2026). Uma consulta ao TRF1 retornou o processo com 43 movimentações, classe, órgão julgador e datas.

### O que entrega
- Capa processual: número CNJ, classe, assunto, órgão julgador, valor da causa, grau, data de ajuizamento, sistema de origem.
- Lista completa de **movimentações** (andamentos), cada uma com código CNJ (Tabela Processual Unificada), nome e data/hora.

### O que NÃO entrega
- Documentos / PDFs das peças.
- Inteiro teor de decisões e despachos (isso é a Comunica/DJEN).
- Partes com dados completos (vem limitado/anonimizado em muitos tribunais).
- Processos em **segredo de justiça**.
- Dado em tempo real: há **defasagem** de atualização (cada tribunal alimenta o DataJud em lote, tipicamente com atraso de horas a dias).

### Como acessar
- **Endpoint**: um por tribunal, no padrão
  `https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search`
  Exemplos de alias: `api_publica_tjsp`, `api_publica_trf1`, `api_publica_stj`, `api_publica_trt2`, `api_publica_tjmt`. A lista completa de aliases está na wiki.
- **Método**: `POST`, corpo em JSON no formato **Elasticsearch Query DSL** (a base roda em Elasticsearch).
- **Autenticação**: header `Authorization: APIKey <chave-pública>`.
  Chave pública atual (divulgada pelo próprio CNJ, igual para todos):
  ```
  cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
  ```
  Não precisa de cadastro nem de solicitar chave. Fonte: https://datajud-wiki.cnj.jus.br/api-publica/acesso/

### Exemplo de requisição (confirmado)
```bash
curl -X POST \
  "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{ "query": { "match": { "numeroProcesso": "00008323520184013202" } } }'
```
Resposta (resumida): `hits.hits[0]._source` traz `classe`, `tribunal`, `orgaoJulgador`, `dataAjuizamento` e o array `movimentos[]` com `{codigo, nome, dataHora}`.

### Limites de uso (rate limit)
A wiki declara limite por chave, ajustável mediante justificativa para uso em escala. Na prática, a chave pública tolera consulta pontual bem (o modelo "sob comando" do Gabinete). Para coleta automática em lote (Fase 3), respeitar intervalo entre requisições e paginar via `search_after` / `scroll`. Termo de uso: https://formularios.cnj.jus.br (Termos de uso da API pública do Datajud).

### Requisitos para o Gabinete usar
Nenhum além da chave pública. É a fonte que a tool `consultar_processo` / `sincronizar_carteira` consome.

---

## 2. Comunica API / DJEN — Diário de Justiça Eletrônico Nacional (CNJ)

**A fonte oficial dos prazos.** Desde as Resoluções CNJ nº 455/2022 e nº 569/2024, as intimações dirigidas a advogados são publicadas no **Diário de Justiça Eletrônico Nacional (DJEN)**, unificado, com o **inteiro teor** de despachos, decisões e dispositivos de sentença. Antes ficava espalhado em dezenas de diários estaduais; hoje uma consulta por OAB traz tudo, de todos os tribunais, num lugar só.

Atenção à distinção entre dois produtos que convivem sob a Resolução 455:
- **DJEN** (Diário) → publicação/consulta de intimações. É o que o Gabinete lê. Frontend em `https://comunica.pje.jus.br/consulta`.
- **Domicílio Judicial Eletrônico** → plataforma de citação/intimação direta de empresas e órgãos (não é consulta pública de diário).

### O que entrega
- Comunicações (intimações/publicações) com: tribunal, tipo de comunicação, número do processo, órgão, data de disponibilização, data de publicação, destinatários, advogados destinatários (com OAB) e o **texto/inteiro teor** da publicação.

### Como acessar (consulta pública)
- **Endpoint de consulta**: `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao`
- **Autenticação**: a **consulta é pública** (sem login), filtrada por OAB. É esse endpoint que o site `comunica.pje.jus.br/consulta` chama.
- **Parâmetros de query** principais:
  | Parâmetro | Uso |
  |---|---|
  | `numeroOab` | número da OAB do advogado (sem UF) |
  | `ufOab` | UF da OAB (ex.: `SP`, `BA`) |
  | `nomeAdvogado` | busca por nome |
  | `dataDisponibilizacaoInicio` / `dataDisponibilizacaoFim` | janela de datas (`YYYY-MM-DD`) |
  | `siglaTribunal` | filtra por tribunal (ex.: `TJSP`) |
  | `numeroProcesso` | filtra por processo |
  | `pagina` / `itensPorPagina` | paginação |
  | `meio` | `D` = diário |
- **Certidão em PDF**: cada comunicação tem endpoint de certidão, no padrão
  `https://comunicaapi.pje.jus.br/api/v1/comunicacao/{hash}/certidao`.
- Documentação (Swagger): https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0

### Resposta
`{ status, message, count, items: [ { siglaTribunal, tipoComunicacao, numeroprocessocommascara, data_disponibilizacao, texto, destinatarioadvogados: [...], ... } ] }`

### GOTCHA importante (verificado, e corrige uma suposição anterior)
Chamar a Comunica com um cliente HTTP simples (o `fetch` do Node) retorna **403**. Testado em duas
situações e o resultado é o mesmo:
- De servidor/datacenter: 403.
- **Da máquina local (IP residencial): TAMBÉM 403.** Ou seja, o bloqueio **não é por IP**, como se
  poderia supor. É o **desafio de navegador do CloudFront/WAF da AWS**, que barra qualquer requisição
  sem a assinatura de um browser real rodando o app.
- Navegar **direto na URL da API por um navegador** também é barrado ("The request could not be
  satisfied", CloudFront): o WAF exige que a chamada saia **de dentro do SPA** (`comunica.pje.jus.br`),
  que injeta os cabeçalhos/sessão esperados.

Implicações práticas para a coleta de intimações (as saídas realmente funcionais):
- **(a) Automação de navegador na máquina do advogado**: abrir o SPA `comunica.pje.jus.br/consulta`
  com Playwright, deixar o JS resolver o desafio, e disparar a consulta pela própria interface (ou
  um `fetch` no contexto da página, same-origin). É o caminho fiel ao "sob comando".
- **(b) Intermediário pago** (Judit/Escavador/Digesto): entrega a intimação já normalizada, sem
  brigar com o WAF. Mais simples e estável para automação; tem custo por consulta/assinatura.
- **(c) Redundância por e-mail**: o advogado recebe as intimações no Gmail; o n8n lê e cruza.
- Registrar sempre a **última sincronização** no painel. As APIs do CNJ oscilam.

> Nota: o cliente `comunica.ts` do MVP faz a chamada HTTP direta (que hoje toma 403 pelo WAF). Para
> a coleta funcionar de fato, a tool `buscar_intimacoes` precisa evoluir para o caminho (a) ou (b).
> É um ponto de integração conhecido, não um bug de código.

### Requisitos para o Gabinete usar
Só a OAB e UF do advogado. É a fonte da tool `buscar_intimacoes`, e a matéria-prima do cálculo de prazo.

---

## 3. MNI — Modelo Nacional de Interoperabilidade

O padrão oficial (CNJ + parceria com os tribunais) para sistemas conversarem com os processos eletrônicos. É por aqui que se puxa **documento inteiro dos autos** direto do tribunal, sem intermediário pago.

### O que entrega
- `consultarProcesso`: dados do processo + lista de documentos + **inteiro teor** dos documentos (quando autorizado).
- `consultarAvisosPendentes`: intimações pendentes.
- `entregarManifestacaoProcessual`: peticionamento (fora do escopo do Gabinete por decisão de produto).

### Como acessar
- **Tecnologia**: Web Service **SOAP** (WSDL), versão MNI **2.2.2**. Um endpoint por tribunal (PJe, eproc, Projudi etc.), cada um com sua URL.
- **Autenticação**: par `consultante`/`senha` **e/ou certificado digital ICP-Brasil** (e-CPF A1/A3 do advogado). Para acessar documentos restritos ou em segredo de justiça, o advogado precisa estar **habilitado no processo**.
- Documentação: https://docs.pje.jus.br/servicos-auxiliares/servico-mni-client/ e https://www.pdpj.jus.br

### Custo
Gratuito em si (é do tribunal), mas o custo real é a **complexidade**: integrar tribunal a tribunal, cada um com sua peculiaridade de WSDL e credenciamento. Por isso o Gabinete deixa MNI direto para a **Fase 3**, só se o volume justificar.

### Requisitos
Certificado digital ICP-Brasil do advogado (A1 é o mais prático para servidor, arquivo `.pfx`; A3 é token/cartão). Credenciamento no sistema de cada tribunal.

---

## 4. Camada paga de documentos (intermediários comerciais)

Quando o advogado quer baixar os PDFs dos autos sem lidar com certificado tribunal a tribunal, entram os agregadores. Só usar **quando o advogado pede** (a tool `baixar_autos`).

| Serviço | Como funciona | Quando no Gabinete |
|---|---|---|
| **Judit.io** | Monitoramento com `with_attachments` + webhook; baixa anexos a cada nova movimentação. API REST moderna. | Fase 2, automação plena de documentos |
| **Escavador API v2** | Aceita o **certificado A1 do advogado** para autos restritos (armazenado encriptado); parâmetro `documentos_especificos=INICIAIS` reduz custo. | Fase 2, autos restritos |
| **Digesto / Codilo / Jusbrasil (Predictus)** | Bases agregadas + download de peças, cobertura ampla de tribunais. | Alternativas ao Judit/Escavador |
| **MNI direto** | Sem intermediário, mas por sua conta (ver seção 3). | Fase 3 |
| **Upload manual** | Advogado arrasta o PDF no painel ou aponta no terminal. | Sempre, desde o MVP |

Todos exigem **cadastro + API key + pagamento** (por consulta ou assinatura). Para autos restritos, mesmo o intermediário precisa do **certificado do advogado habilitado** — a lei não muda: sem habilitação no processo, não há acesso ao sigiloso.

---

## 5. Requisitos de acesso, consolidado

O que o advogado precisa ter em mãos para cada fonte:

| Fonte | Precisa de | Cadastro? | Custo |
|---|---|---|---|
| DataJud | Nada (chave pública embutida) | Não | R$ 0 |
| Comunica/DJEN | OAB + UF | Não | R$ 0 |
| MNI direto | Certificado ICP-Brasil (e-CPF) + habilitação no processo + credencial do tribunal | Sim, por tribunal | R$ 0 (fora o certificado) |
| Judit / Escavador / Digesto | API key da conta + pagamento; certificado A1 p/ autos restritos | Sim | Pago |

**O MVP do Gabinete precisa apenas de: a OAB do advogado e a lista de números CNJ da carteira.** DataJud + Comunica cobrem coleta de andamentos e intimações sem custo e sem certificado. Documento só quando pedir.

---

## 6. Conformidade e limites (o que a lei impõe)

- **Segredo de justiça**: não aparece no DataJud nem na consulta pública da Comunica. Só via MNI/Escavador **com o certificado do advogado habilitado**. O sistema respeita o que o tribunal autoriza.
- **LGPD**: dados processuais públicos têm base legal tranquila (art. 7º e publicidade dos atos processuais). Documentos e dados de clientes exigem acesso restrito, criptografia em trânsito e repouso (padrão Supabase), logs de acesso e contrato de tratamento (agência = operadora, advogado = controlador).
- **Fronteira do produto**: o sistema coleta, organiza, analisa e **sugere** prazo. Não peticiona, não decide, não é consultoria jurídica. O prazo é responsabilidade do advogado: a máquina propõe, o profissional confirma.
- **Determinismo no crítico**: a IA classifica o ato; o **código** calcula a data fatal (dias úteis, CPC art. 219). Campo crítico nunca sai de alucinação de LLM.

---

## Fontes

- API Pública DataJud (acesso e chave): https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- DataJud (portal CNJ): https://www.cnj.jus.br/sistemas/datajud/api-publica/
- Termos de uso DataJud: https://formularios.cnj.jus.br/wp-content/uploads/2023/05/Termos-de-uso-api-publica-V1.1.pdf
- Comunica/PCP (Swagger): https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0
- Comunicações Processuais (frontend): https://comunica.pje.jus.br/
- Orientações CNJ (comunicações processuais): https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/orientacoes-aos-tribunais/
- Padrões de API do PJe: https://docs.pje.jus.br/manuais-basicos/padroes-de-api-do-pje/
- Serviço MNI Client: https://docs.pje.jus.br/servicos-auxiliares/servico-mni-client/
- Resoluções CNJ 455/2022 e 569/2024 (base legal do DJEN)
