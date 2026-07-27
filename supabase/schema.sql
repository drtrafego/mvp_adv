-- ============================================================================
-- Gabinete · schema do Supabase / Postgres
-- Fonte da verdade do sistema. O MCP grava aqui, o painel lê daqui, o Realtime
-- acende a tela. A "regra de ouro" (máquina propõe, humano dispõe) vive no
-- campo `origem` de prazos e analises: quando vira 'humana', o motor não sobrescreve.
-- ============================================================================

-- Carteira de processos
create table if not exists processos (
  id uuid primary key default gen_random_uuid(),
  numero_cnj text unique not null,
  tribunal text not null,
  classe text,
  assunto text,
  orgao_julgador text,
  valor_causa numeric,
  grau text,
  partes jsonb,
  cliente_nome text,                      -- cache de leitura; parte real fica em processo_partes
  fase text default 'postulatoria',       -- postulatoria | contestacao | saneamento | instrucao | sentenca | recurso | cumprimento | arquivado
  status text default 'ativo',            -- ativo | arquivado | suspenso
  ultima_sincronizacao timestamptz,
  arquivado_em timestamptz,
  excluido_em timestamptz,                 -- soft-delete
  created_at timestamptz default now()
);

-- Histórico de mudança de fase do processo (auditoria do estágio processual)
create table if not exists fases_processo (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  fase text not null,
  fase_anterior text,
  motivo text,
  autor text default 'advogado',
  origem text default 'humana',            -- humana | maquina
  criado_em timestamptz default now()
);

-- Andamentos: automáticos (DataJud, read-only) + manuais (fonte='manual', editáveis)
create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  codigo_cnj int,
  descricao text not null,
  data_hora timestamptz not null,
  complemento jsonb,
  fonte text default 'datajud',
  criado_por text,
  editado_em timestamptz
);

-- Intimações do DJEN (Comunica)
create table if not exists comunicacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id),
  numero_processo text,
  hash_djen text unique,
  tipo text,
  meio text default 'DJEN',
  inteiro_teor text,
  data_disponibilizacao date,
  data_publicacao date,
  oab_destino text,
  processada boolean default false,
  created_at timestamptz default now()
);

-- PDFs dos autos
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  titulo text,
  tipo text,
  categoria text,
  storage_path text not null,
  paginas int,
  hash_sha256 text,
  texto_extraido boolean default false,
  fonte text,
  descricao text,
  data_documento date,
  created_at timestamptz default now()
);

-- Notas livres do advogado sobre um processo, cliente ou prazo.
-- processo_id e nullable; cliente_id/prazo_id e o CHECK sao adicionados no fim
-- do arquivo (depois que clientes e prazos existem).
create table if not exists anotacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  texto text not null,
  autor text default 'advogado',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Cadastro de clientes/partes, reaproveitável entre processos
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  tipo_documento text,                     -- cpf | cnpj
  email text,
  telefone text,
  observacoes text,
  criado_em timestamptz default now()
);

-- Vínculo processo <-> cliente com o papel
create table if not exists processo_partes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  papel text not null,                     -- autor | reu | terceiro | ...
  principal boolean default false,
  unique (processo_id, cliente_id, papel)
);

-- Análises da IA, versionadas
create table if not exists analises (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  documento_id uuid references documentos(id),
  tipo text not null,
  conteudo jsonb not null,
  versao int default 1,
  origem text default 'maquina',          -- maquina | humana
  editado_por text,
  editado_em timestamptz,
  modelo text,
  tokens_input int,
  tokens_output int,
  custo_usd numeric(10,5),
  created_at timestamptz default now()
);

-- O coração: prazos
create table if not exists prazos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  comunicacao_id uuid references comunicacoes(id),
  ato text not null,
  regra_aplicada text,
  dias int,
  contagem text default 'uteis',          -- uteis | corridos
  data_publicacao date,
  data_inicio date,
  data_fatal_sugerida date not null,
  data_fatal date not null,
  status text default 'sugerido',         -- sugerido | confirmado | editado | cancelado
  origem text default 'maquina',          -- maquina | humana
  justificativa_ia text,
  divergencia jsonb,
  editado_por text,
  editado_em timestamptz,
  alertas_enviados jsonb default '[]',
  created_at timestamptz default now()
);

-- Suspensões e feriados forenses por tribunal
create table if not exists feriados_forenses (
  id uuid primary key default gen_random_uuid(),
  tribunal text not null,
  data date not null,
  descricao text,
  tipo text default 'feriado',
  unique (tribunal, data)
);

-- Registro de coletas: o que foi buscado, quando e com qual resultado.
-- Diferencia "sem intimação" (status ok, itens 0) de "falha na coleta" (status erro).
create table if not exists sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,                     -- djen | datajud
  escopo text,                             -- ex.: 'OAB 11158/MT' ou numero_cnj
  status text not null,                    -- ok | erro | parcial
  itens int default 0,
  novos int default 0,
  mensagem text,
  iniciado_em timestamptz default now(),
  concluido_em timestamptz
);

create index if not exists idx_prazos_fatal on prazos (data_fatal, status);
create index if not exists idx_comunic_proc on comunicacoes (processada);
create index if not exists idx_mov_proc on movimentacoes (processo_id, data_hora desc);
create index if not exists idx_sinc_fonte on sincronizacoes (fonte, iniciado_em desc);
create index if not exists idx_fases_proc on fases_processo (processo_id, criado_em);
create index if not exists idx_anotacoes_proc on anotacoes (processo_id, criado_em);
create index if not exists idx_clientes_doc on clientes (documento);

-- Dedup de movimentações só vale para o DataJud (automáticas). Manuais podem repetir.
-- Substitui a unique cheia (processo_id, codigo_cnj, data_hora) por índice parcial.
alter table movimentacoes drop constraint if exists mov_unique;
create unique index if not exists mov_unique_datajud
  on movimentacoes (processo_id, codigo_cnj, data_hora)
  where fonte = 'datajud';

-- =====================================================================
-- Feature Peças: biblioteca de modelos do escritório + rascunhos gerados
-- =====================================================================

-- Peças-modelo do escritório (upload). Base de estrutura/estilo do redator.
create table if not exists modelos_peca (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                        -- inicial | contestacao | recurso | ...
  titulo text not null,
  texto_extraido text,
  arquivo_nome text,
  storage_path text,
  tags text[] default '{}',
  ativo boolean default true,
  criado_em timestamptz default now()
);
create index if not exists idx_modelos_tipo on modelos_peca (tipo);

-- Rascunhos de peça gerados. Nascem origem 'maquina' (amarelo); o advogado
-- edita/aprova e vira 'humana' (verde). O motor nunca sobrescreve humano.
create table if not exists pecas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  prazo_id uuid references prazos(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  modelo_base_id uuid references modelos_peca(id),
  tipo text not null,
  titulo text,
  conteudo text,
  status text default 'pendente',            -- pendente | gerado | editado | arquivado
  origem text default 'maquina',             -- maquina | humana
  versao int default 1,
  editado_por text,
  editado_em timestamptz,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
create index if not exists idx_pecas_processo on pecas (processo_id, criado_em);

-- Estende anotacoes para aceitar cliente ou prazo como alvo (alem de processo).
-- Idempotente: seguro rodar em banco novo e em banco ja existente.
alter table anotacoes alter column processo_id drop not null;
alter table anotacoes add column if not exists cliente_id uuid references clientes(id) on delete cascade;
alter table anotacoes add column if not exists prazo_id uuid references prazos(id) on delete cascade;
create index if not exists idx_anotacoes_cliente on anotacoes (cliente_id, criado_em);
create index if not exists idx_anotacoes_prazo on anotacoes (prazo_id, criado_em);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'anotacoes_um_alvo') then
    alter table anotacoes add constraint anotacoes_um_alvo
      check (num_nonnulls(processo_id, cliente_id, prazo_id) = 1);
  end if;
end $$;

-- ============================================================================
-- RLS: no MVP mono-usuário, o painel usa a service role no servidor. Se abrir
-- para multiusuário, habilitar RLS por escritório. Deixamos as políticas
-- comentadas como ponto de partida.
-- ============================================================================
-- alter table processos enable row level security;
-- alter table prazos enable row level security;
-- (definir policies por auth.uid()/escritorio_id quando for multiusuário)

-- ============================================================================
-- Camada de documentos do processo (upload pelo painel e pelo terminal).
-- O binário mora no Vercel Blob (privado); aqui ficam metadado, hash e o texto
-- extraído, que é o que o squad forense lê para analisar.
-- ============================================================================
alter table documentos add column if not exists arquivo_nome text;
alter table documentos add column if not exists mime_type text;
alter table documentos add column if not exists tamanho_bytes bigint;
alter table documentos add column if not exists texto text;
alter table documentos add column if not exists extracao_status text default 'pendente';
alter table documentos add column if not exists extraido_em timestamptz;
alter table documentos add column if not exists enviado_por text;
alter table documentos add column if not exists excluido_em timestamptz;

comment on column documentos.categoria is
  'Funcao processual: inicial | procuracao | contestacao | replica | decisao | despacho | sentenca | acordao | recurso | contrarrazoes | prova | laudo | contrato | comprovante | ata_audiencia | certidao | outro';
comment on column documentos.tipo is 'Formato normalizado: pdf | docx | imagem | texto';
comment on column documentos.fonte is 'Canal de origem: upload_painel | upload_terminal | mni | escavador';
comment on column documentos.texto_extraido is 'Flag: tem texto utilizavel. O conteudo fica na coluna texto.';
comment on column documentos.extracao_status is 'pendente | ok | sem_texto | falhou | nao_aplica';
comment on column documentos.storage_path is
  'Pathname imutavel no Blob: processos/<cnj-digitos>/<categoria>/<data>-<slug>-<hash8>.<ext>';

-- Dedup por processo: o mesmo arquivo nao entra duas vezes no mesmo processo
-- (mas pode existir em processos diferentes, o que e legitimo).
create unique index if not exists documentos_hash_unico
  on documentos (processo_id, hash_sha256)
  where hash_sha256 is not null and excluido_em is null;

create index if not exists idx_docs_proc
  on documentos (processo_id, categoria, created_at desc);

-- Documento anexado a uma PEÇA, não a um processo: a petição inicial de caso novo ainda não
-- tem número CNJ, mas já tem contrato, comprovante e procuração para o squad usar.
alter table documentos add column if not exists peca_id uuid references pecas(id) on delete cascade;
create index if not exists idx_docs_peca on documentos (peca_id, categoria, created_at desc);
comment on column documentos.peca_id is
  'Documento preso a uma peça (caso novo, sem processo). Exatamente um entre processo_id e peca_id.';

-- Dedup também para documento de peça (o índice anterior cobre só processo_id).
create unique index if not exists documentos_hash_peca_unico
  on documentos (peca_id, hash_sha256)
  where peca_id is not null and hash_sha256 is not null and excluido_em is null;

-- Partes destinatárias da comunicação, como o DJEN devolve: [{nome, polo}] (A = ativo,
-- P = passivo). É a fonte mais confiável de quem é a parte do escritório, porque a intimação
-- é dirigida a ela. Antes esse dado era descartado na normalização.
alter table comunicacoes add column if not exists destinatarios jsonb;
